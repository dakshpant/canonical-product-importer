# Canonical Product Importer

An inventory admin pastes product URLs. The backend scrapes each page, maps what it finds onto the canonical product schema, checks every value against the page, and saves the product for review. **Nothing goes live until the admin approves it.**

The aim is to turn the admin's job from typing ~25 fields per product into checking pre-filled fields against their source.

---

## Project status

| Area | Status |
| --- | --- |
| Database (Prisma + SQLite, canonical snake_case fields) | ✅ Done |
| URL validation and in-batch de-duplication | ✅ Done |
| Safe fetching (public addresses only, robots.txt, timeouts, size limit) | ✅ Done |
| HTML, metadata and JSON-LD extraction | ✅ Done |
| AI extraction (Groq) with backend verification of every value | ✅ Done, 58 unit tests |
| Saving a product, or a refresh proposal for an existing one | ✅ Done |
| Sequential batch processing, with failures kept per URL | ✅ Done |
| Frontend screens (Import, Product list, Review, Import summary, Refresh) | ✅ Built. All screens are connected to the API |
| HTTP API | ✅ Done. See [docs/api-contract.md](docs/api-contract.md) |
| Retries for blocked, timed-out and temporary scrape errors | ⬜ To do (LLM calls already retry) |
| Running without an API key (recorded responses) | ⬜ To do |
| Seed products for the refresh demo | ⬜ To do |
| Results run on 8 real pages | ⬜ To do. See [docs/results-report.md](docs/results-report.md) |
| Demo recording | ⬜ To do |

---

## Requirements

- **Node.js 22.18 or newer** (tested on 24.x). The backend imports Prisma's generated TypeScript client directly, which needs Node's built-in type stripping.
- npm
- A free **Groq API key** for live extraction ([console.groq.com](https://console.groq.com)). The unit tests do not need one.

## Setup and run

Run these from the repository root, in two terminals.

```bash
# Terminal 1 — backend: install, create .env and the SQLite database, start the API on :5001
cd server && npm install && npm run setup && npm run dev

# Terminal 2 — frontend: install and start on http://localhost:5173
cd client && npm install && npm run dev
```

For live extraction, put your key in `server/.env` (created by `npm run setup`) and restart the backend:

```bash
GROQ_API_KEY=gsk_...
```

### Run the tests

```bash
cd server && npm test
```

The tests use a fake LLM client and fake page input, so they need no network, API key or database.

### Try the pipeline from the command line

```bash
cd server
node src/run-ai-extraction.js https://www.hubspot.com/products/crm   # scrape + extract one URL, print the result, save nothing
node src/run-import-batch.js <url> [url ...]                         # full import: saves products to the database
```

---

## How it works

```
Admin pastes URLs
   │
   ▼
1. Validate      http(s) only, no credentials in the URL, duplicates in the batch flagged
2. Fetch         robots.txt check → public IP check → fetch (15 s, 2 MB, max 5 redirects)
3. Extract       title, meta and Open Graph tags, JSON-LD, readable page text (no raw HTML)
4. Propose       Groq LLM returns JSON matching a strict schema, with a quote for each value
5. Verify        the backend keeps a value only if it finds it on the page itself
6. Save          new product (Draft / Under Review) or, for a known URL, a refresh proposal
   │
   ▼
Admin reviews each field next to its source line → edits → approves (Active) or rejects (Draft)
```

Each URL in a batch runs on its own, one after another. If a URL fails, its record is marked `FAILED` with a `CODE: message` reason and the batch moves on to the next one.

### How values are checked (the trust boundary)

The LLM only proposes values. [`verify-extraction.js`](server/src/services/ai/verify-extraction.js) decides what is kept:

| Kind of field | Fields | Rule |
| --- | --- | --- |
| Copied text | `name`, `tagline`, `short_description`, `overview`, `sub_category`, `image_alt`, `tags`, `skills`, `features`, `target_customers` | Must appear word for word in **one** place on the page. The page's own wording is stored, not the model's |
| Classification | `product_kind`, `category`, `industry`, `platforms`, `deployments` | Must be a value from a fixed list ([`taxonomy.js`](server/src/constants/taxonomy.js)), **and** the line the model quoted must contain one of that value's keywords |
| URLs | `website`, `image_url`, `image_source_page` | Must already exist in the page's metadata or JSON-LD. Never built by the app or the model |
| Set by the app | `image_type` | Taken from where the image URL was found (`og:image`, `logo`, `image`) |

Every value that fails a rule is dropped and recorded under `review.discarded` with a reason, so the admin can see what was removed and why. Every value that is kept gets a `ProductSource` row containing the matching page line.

### Field ownership

| Fields | Who fills them |
| --- | --- |
| `name`, `product_kind`, `category`, `industry`, `sub_category`, `tagline`, `short_description`, `overview`, `website`, image fields, product attributes, `sources` | Scraped and proposed by the app. The admin can edit them |
| `slug` | Generated from `name` when the product is created, and unique |
| `sku_id` | Generated by the app, never scraped (generation still to be wired in, currently `null`) |
| `unit_of_measure`, `min_quantity`, `max_quantity` | Entered by the admin only. Never extracted or guessed |

### Statuses

| Status | When |
| --- | --- |
| `DRAFT` | `name`, `category` or `short_description` is still missing after the scrape, or the admin rejected the product |
| `UNDER_REVIEW` | Extraction finished with all required fields, and the product is waiting for the admin |
| `ACTIVE` | The admin approved it. Only a human action can set this |

Import records track the outcome per URL: `SUCCESS`, `PARTIAL` (saved, but required fields are missing) or `FAILED` (with a reason).

### Refresh

When a URL that is already in the catalogue is imported again, the app does not create a duplicate and does not change the product. It saves a `ProductUpdateProposal` that contains only the non-empty new values. The admin then picks, field by field, whether to keep the current value or take the new one. A blank value can never replace an existing one.

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full picture.

```
client/   React 19 + Vite + Tailwind — Import, Product list, Review, Import summary screens
server/   Node + Express 5 + Prisma 7 + SQLite
  src/
    routes/ controllers/      HTTP layer
    services/scraper/         safe fetch, robots.txt, network safety, HTML/JSON-LD extraction
    services/ai/              Groq client, prompt, verification (trust boundary)
    services/product/         batch creation, sequential processing, persistence, refresh proposals
    validators/               URL validation, Zod schema for LLM output
    constants/                statuses, taxonomy (fixed lists)
  prisma/                     schema and migrations
docs/     architecture, design note, decisions, API contract, results, AI usage
```

### Data model

| Model | Purpose |
| --- | --- |
| `Product` | The canonical record. Field names match the canonical schema exactly |
| `ImportBatch` | One admin import of one or more URLs, with progress counts |
| `ImportRecord` | One URL in a batch: status, attempts, error, the full extraction result |
| `ProductSource` | Evidence for each field: the value, the page line it came from, the section and the URL |
| `ProductUpdateProposal` | New values from a refresh, kept apart from the record until the admin decides |

## Environment variables

See [`server/.env.example`](server/.env.example). `.env` is git-ignored; never commit keys.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite database file |
| `PORT` | `5001` | API port. The Vite dev server proxies `/api` here. Not 5000: macOS AirPlay Receiver uses it |
| `NODE_ENV` | `development` | Runtime mode |
| `GROQ_API_KEY` | (empty) | Groq key for live extraction. Never logged; removed from error messages |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq model |

If you change `PORT`, start the frontend with `VITE_API_PROXY_TARGET=http://localhost:<port> npm run dev`.

### Backend scripts (`server/`)

| Command | What it does |
| --- | --- |
| `npm run setup` | Create `.env` from `.env.example` and apply migrations |
| `npm run dev` / `npm start` | Start the API (with or without file watching) |
| `npm test` | Run the unit tests (AI extraction, refresh rules, admin edit checks) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:reset` | Drop the local database and re-apply all migrations (deletes local data) |
| `npm run db:generate` | Regenerate the Prisma client (runs automatically on `npm install`) |

---

## Assumptions

- One admin user, so there is no login.
- Only public pages are scraped. Anything behind a login, blocked by robots.txt or on a private network address is refused.
- If robots.txt cannot be fetched or returns an error, the page is **not** scraped (the safe default).
- Required fields for `UNDER_REVIEW` are `name`, `category` and `short_description`. Without them the product stays `DRAFT`.
- A product without a `name` on the page is not created (the database needs a name and we will not invent one). The import record is marked `PARTIAL` instead.
- `category`, `industry`, `product_kind`, `platforms` and `deployments` use fixed lists, so the catalogue stays consistent. A page that fits no list value leaves the field empty.
- Existing products are matched by exact normalised URL (the import URL or the extracted `website`), never by name.
- A batch processes URLs one at a time. Slower, but predictable and gentle on vendor sites and the free LLM tier.

## Known limits

- **JavaScript-only pages** are not supported. Fetching is plain HTTP, so client-rendered pages come back thin.
- **Long pages** are cut to fit Groq's free-tier limit (~10,000 characters sent to the model). Content further down the page may be missed.
- **Matching is exact.** Paraphrased values are dropped by design, so some correct but reworded values are lost. The trade-off favours "no invented data" over "more fields filled".
- **One image** per product (the canonical schema has a single set of image fields).
- **Free-tier rate limits.** Large batches can hit Groq's per-minute limit. The client waits (up to 60 s, three times) before failing the record.
- **Response bodies are decoded as UTF-8** only.
- **Background batches are in-process.** If the server restarts mid-import, records left in `PROCESSING` are not resumed.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/design-note.md](docs/design-note.md) | One page: key decisions, trade-offs, what to build next |
| [docs/design-decisions.md](docs/design-decisions.md) | Each decision in detail, with alternatives considered |
| [docs/architecture.md](docs/architecture.md) | Components, data flow, error handling |
| [docs/api-contract.md](docs/api-contract.md) | Endpoints the frontend uses, and which are implemented |
| [docs/results-report.md](docs/results-report.md) | Measurements on real product pages |
| [docs/ai-usage.md](docs/ai-usage.md) | Where AI coding tools were used and what was checked by hand |
