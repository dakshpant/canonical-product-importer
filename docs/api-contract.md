# API contract (frontend ↔ backend)

The frontend calls only these endpoints, under `/api` (Vite proxies `/api` to `http://localhost:5001` in development). All field names are the canonical snake_case names from `prisma/schema.prisma`, unchanged. Errors return a non-2xx status with `{ "error": "message" }`.

Client: [`client/src/services/api.js`](../client/src/services/api.js).

## Implementation status

| Endpoint | Status | Gap |
| --- | --- | --- |
| `POST /api/imports` | ✅ Done | Replies `202 { batch }` straight away and processes in the background |
| `GET /api/imports` | ✅ Done | |
| `GET /api/imports/:id` | ✅ Done | Records include `update_proposal` (`{ id, status }` or `null`) |
| `GET /api/products` | ✅ Done | Includes `pending_proposals` |
| `GET /api/products/:id` | ✅ Done | Pending `update_proposals` are newest first; `import_records` newest first |
| `PATCH /api/products/:id` | ✅ Done | Blank text → `null`; lists de-duplicated; URLs must be http(s); `min_quantity ≤ max_quantity` (checked against the stored value too). An Active product cannot lose a required field |
| `POST /api/products/:id/approve` | ✅ Done | 400 lists the missing required fields |
| `POST /api/products/:id/reject` | ✅ Done | Status → `DRAFT`; values kept |
| `GET /api/products/proposals/:proposalId` | ✅ Done | `{ proposal }` with `product`, `proposed_data`, `sources` (evidence for the new values) and `import_record`. Used by the Review page when opened with `?proposalId=` |
| `POST /api/proposals/:id/review` | ✅ Done | 400 for app-owned/unknown fields or bad decisions, 404 if missing, 409 if already reviewed. Older pending proposals for the product are marked `REJECTED` |

The error handler returns `{ success: false, message }`. The client reads `message` as a fallback, so errors already display correctly.

## Imports

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/imports` | `{ urls: string[] }` | `{ batch }` — the `ImportBatch` with `records`. Processing starts in the background (`processImportBatch`) after the response. |
| `GET` | `/api/imports` | | `{ batches: ImportBatch[] }`, newest first. Records not needed. |
| `GET` | `/api/imports/:id` | | `{ batch }` with `records`. Polled every 2–3 s until `status` is `COMPLETED`, `PARTIAL` or `FAILED`. |

Each record needs: `id, url, status, error_message, attempts, product_id, extracted_data, created_at`, and `update_proposal` (or `null`) so the summary can show which records were refreshes.

- `error_message` uses the existing `"CODE: message"` format. The UI maps the code to a plain-English next step.
- `extracted_data` is the object from `extractProduct()`: `{ product, sources, review: { missing_required_fields, discarded }, extraction }`.

## Products

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/products` | | `{ products }`. Each product has every canonical field, `status`, `updated_at` and `pending_proposals` (count of `PENDING` update proposals). |
| `GET` | `/api/products/:id` | | `{ product }` with `sources` (`ProductSource[]`), `import_records` (at least `url`, `created_at`) and `update_proposals` (status `PENDING`). |
| `PATCH` | `/api/products/:id` | Changed fields only | `{ product }`. Blank values arrive as `null`, lists as `string[]`. Must reject `sku_id`, `slug`, `status` and unknown keys, and validate the rest. |
| `POST` | `/api/products/:id/approve` | | `{ product }` with `status: "ACTIVE"`. Must refuse with 4xx if `name`, `category` or `short_description` is empty. |
| `POST` | `/api/products/:id/reject` | | `{ product }` with `status: "DRAFT"`. |

## Refresh

The **Re-scrape** button calls `POST /api/imports` with the product's latest import URL. The backend is expected to detect the existing product by normalised URL and save a `ProductUpdateProposal` instead of a new product (see [design-decisions.md](design-decisions.md)).

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/proposals/:id/review` | `{ decisions: { [field]: "current" \| "proposed" } }` | `{ product }`. Applies only the fields set to `"proposed"`, stores the decisions in `reviewed_fields` and marks the proposal `APPROVED` (or `REJECTED` if none were taken). Must never write a blank proposed value over an existing one. |

The UI only offers fields where the new value is non-empty and different from the current one.
