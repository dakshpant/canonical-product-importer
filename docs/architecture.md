# Architecture

## Overview

```
┌──────────────────────┐   /api (Vite proxy)   ┌───────────────────────────────────────────┐
│  client (React/Vite) │ ────────────────────▶ │  server (Express)                          │
│  Import              │                       │                                            │
│  Product list        │                       │  routes → controllers → services           │
│  Review / Refresh    │                       │                                            │
│  Import summary      │                       │  scraper ──▶ ai ──▶ product ──▶ Prisma ──▶ SQLite
└──────────────────────┘                       └───────────────────────────────────────────┘
                                                        │             │
                                                        ▼             ▼
                                                 vendor pages      Groq API
                                               (public, robots)  (LLM proposals)
```

The browser only talks to our own API. All scraping and LLM calls happen on the backend.

## Backend layers

| Layer | Folder | Responsibility |
| --- | --- | --- |
| HTTP | `src/routes`, `src/controllers`, `src/middlewares` | Parse requests, call services, shape responses, one error handler |
| Validation | `src/validators` | URL checks and batch de-duplication; Zod schema for LLM output (also sent to Groq as the strict JSON schema) |
| Scraper | `src/services/scraper` | Safe fetching and turning HTML into bounded input for the LLM |
| AI | `src/services/ai` | Prompt, Groq client, output parsing, **verification against the page** |
| Product | `src/services/product` | Batch creation, sequential processing, saving products, sources and refresh proposals |
| Data | `prisma/`, `src/config/prisma.js` | Schema, migrations, client |

## Pipeline for one URL

[`processImportRecord`](../server/src/services/product/import-processor.service.js):

1. **Claim.** The record moves from `PENDING` to `PROCESSING` in a single conditional update, so a record is never processed twice. `attempts` is incremented.
2. **Fetch** ([`scraper/`](../server/src/services/scraper)):
   - `robot.service.js` reads robots.txt. A disallowed path, or a robots.txt that cannot be fetched, stops the record.
   - `network-safety.js` resolves the host and rejects private, loopback and link-local addresses. The connection is pinned to the checked IP, and every redirect is checked again.
   - `scraper.service.js` fetches with a 15 s timeout, a 2 MB limit and at most 5 redirects.
3. **Extract** (`html-extractor.service.js`, `product-extraction-input.service.js`): page title, meta description, canonical URL, Open Graph tags, JSON-LD nodes and readable page text (headings and list items marked). Raw HTML never goes to the LLM. Pages with too little content are failed early.
4. **Propose** ([`ai/extraction.service.js`](../server/src/services/ai/extraction.service.js)): one Groq call with `temperature: 0` and a strict JSON schema. If Groq answers 413 (larger than the free tier's 8,000 tokens per minute), the call is repeated with 60%, then 36%, of the page text; `extraction.page_text_scale` records how much was sent. The system prompt is [`system.prompt.md`](../server/src/services/ai/system.prompt.md), with the allowed taxonomy lists added from `taxonomy.js` so the prompt and the verifier always agree.
   The client is picked by `LLM_MODE` ([`ai/recorded.client.js`](../server/src/services/ai/recorded.client.js)): live Groq, **record** (live, plus save the answer to `server/recordings/`), or **replay** (the saved answer for that URL, no network). With `auto` (the default), the app is live when a key is set and replays otherwise. Steps 5–7 run the same way for a replayed answer.
5. **Validate** ([`product-extraction.validator.js`](../server/src/validators/product-extraction.validator.js)): Zod checks the shape. Invalid JSON or a schema mismatch gets one retry.
6. **Verify** ([`ai/verify-extraction.js`](../server/src/services/ai/verify-extraction.js)): each value is searched for on the page by the app itself (see the README for the rules). Values that are not found are dropped and listed in `review.discarded` with a reason.
7. **Save** ([`product/product.service.js`](../server/src/services/product/product.service.js)), in one transaction:
   - **Known URL:** a `ProductUpdateProposal` with the non-empty new values only. The product itself is untouched.
   - **New URL, with a name:** a `Product` with a unique `slug` and `sku_id` (`PRD-` + 8 hex, see [`identifiers.js`](../server/src/services/product/identifiers.js)), admin-only fields left `null`, and status `UNDER_REVIEW` if the required fields are present, otherwise `DRAFT`.
   - **New URL, no name:** nothing is created. The record is `PARTIAL`.
   - `ProductSource` rows are written for every kept value.
8. **Finish.** The record becomes `SUCCESS`, `PARTIAL` or `FAILED`, and the batch counters are recomputed from the record statuses (not incremented, so they cannot drift).

## Error handling and retries

| Where | Failure | Behaviour |
| --- | --- | --- |
| Any step for one URL | Any thrown error | Record → `FAILED`, `error_message = "CODE: message"`, the batch continues |
| Scraper | robots.txt disallow, private address, timeout, too large, HTTP error | Coded `ScrapeError`. **No retry yet** (planned for timeouts, 429 and 5xx) |
| Groq | 429 rate limit | Waits for `Retry-After`, up to 3 times and 60 s each. These waits are not counted as attempts |
| Groq | Timeout, network error, 5xx, invalid JSON, schema mismatch | 1 retry after 1 s |
| Groq | 413 (input too large) | Retried with 60%, then 36%, of the page text; fails with `LLM_INPUT_TOO_LARGE` if still too large |
| Groq | 401/403, missing key, no recording in replay mode | Fails at once with a clear code (`LLM_AUTH_FAILED`, `LLM_NOT_CONFIGURED`, `NO_RECORDING`) |
| Logging | — | API keys are removed from every error message (`redact`). Unexpected errors are logged with the URL |

Error codes are defined in [`scraper/scrape-error.js`](../server/src/services/scraper/scrape-error.js) and [`ai/errors.js`](../server/src/services/ai/errors.js). The frontend turns each code into a plain-English next step ([`FailureReason.jsx`](../client/src/components/imports/FailureReason.jsx)).

## Frontend

| Route | Screen | Purpose |
| --- | --- | --- |
| `/import` | `ImportPage` | Paste URLs, start an import, follow progress for each URL |
| `/imports` | `ImportsPage` | Past import batches |
| `/imports/:batchId` | `ImportSummaryPage` | Succeeded, partly filled and failed URLs, with reasons |
| `/products` | `ProductsPage` | Every product, with status filter and a flag on those needing attention |
| `/products/:productId` | `ProductReviewPage` | Each field next to its source evidence; edit, approve, reject; refresh comparison (`RefreshReview`). `?proposalId=` opens a specific refresh |

All calls go through [`client/src/services/api.js`](../client/src/services/api.js). The endpoints are listed in [api-contract.md](api-contract.md).

## Data model

See [`prisma/schema.prisma`](../server/prisma/schema.prisma). List fields (`tags`, `features` and so on) are stored as JSON arrays because SQLite has no array type. Statuses are strings validated in code ([`constants/status.js`](../server/src/constants/status.js)), because SQLite has no enums in Prisma.
