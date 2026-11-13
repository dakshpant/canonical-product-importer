### Decision: URL import processing strategy

**Status:** Decided

**Choice:** Sequential processing (one URL at a time).

**Context:** The application allows an admin to submit multiple product URLs in one import batch. Given the 48-hour assignment deadline, implementation simplicity, reliability and ease of testing are priorities.

**Decision:** Process URLs sequentially. The next URL starts after the current URL finishes processing.

**Expected behaviour:**
- Process one URL at a time.
- Track the status and outcome of every URL independently.
- A failed URL must not stop the remaining URLs.
- Continue processing subsequent URLs even when an individual URL fails.
- Display progress and individual failure reasons in the frontend.

**Alternatives considered:**
1. Sequential processing — selected for simplicity and predictable behaviour.
2. Limited concurrency (2 URLs) — faster in typical cases but requires additional queue management.
3. Fully parallel processing — potentially faster but introduces unnecessary complexity and rate-limit risks.

**Trade-offs:**
- Simpler implementation, debugging and testing.
- Lower simultaneous load on websites and AI providers.
- Longer total processing time for multiple URLs.

**Implementation:** Sequential asynchronous processing in the Node.js backend. No external job queue or concurrency limiter required.

**Future consideration:** Introduce limited concurrency if performance measurements demonstrate a genuine need.

### Decision: Handling partial product extraction

**Status:** Decided

**Choice:** Save partially extracted product data.

**Context:** AI extraction may successfully identify some product fields while leaving others unavailable or uncertain.

**Decision:** Do not fail an entire import simply because some product fields are missing.

**Expected behaviour:**
- Save all valid extracted fields.
- Leave unavailable fields empty rather than guessing.
- Track missing or uncertain fields for admin attention.
- Store available source evidence for extracted values.
- Allow the admin to edit and complete the product during review.
- Determine product status independently using the assignment's required-field rules.

**Import Record outcome:** `PARTIAL` when extraction succeeds but is incomplete.

**Product status:** `DRAFT` if required fields are missing; otherwise `UNDER_REVIEW`, pending admin approval.

**Reason:** Preserve useful data, avoid invented information and reduce manual work for the admin.


### Decision: Handling duplicate URLs and product refreshes

**Status:** Decided

**Choice:** Detect existing products and propose updates without automatic overwriting.

**Context:** An admin may import the same product URL again when the source website has changed.

**Decision:** Identify existing products using their normalized source URL. Treat subsequent imports as refresh attempts rather than automatically creating duplicate products.

**Expected behaviour:**
- Detect an existing product before creating a new one.
- Scrape and extract the latest product information.
- Compare newly extracted values with existing product values.
- Store proposed updates separately from the existing product.
- Preserve previous values until the admin reviews the changes.
- Allow the admin to accept or reject proposed changes.
- Never overwrite populated fields with empty extraction results.
- Preserve application-generated `sku_id` and `slug`.
- Never extract or overwrite admin-only fields.
- Keep the existing product status unchanged while refresh changes await review.

**Reason:** Prevent duplicate records, protect reviewed data and maintain admin control over product updates.

### Decision: The LLM proposes, the backend verifies

**Status:** Decided

**Choice:** Treat LLM output as untrusted. Keep a value only if the app itself finds it on the scraped page.

**Context:** The brief says no invented data and that backend validation is final. LLMs paraphrase, fill gaps from general knowledge and can be steered by text on the page (prompt injection).

**Decision:** After Zod validation, `verify-extraction.js` checks each value:
- Copied fields must be a continuous excerpt from **one** place on the page (one line of text, one metadata value or one JSON-LD string). Sentences from different places cannot be stitched together.
- The stored value is the page's wording, and the evidence shown to the admin is the page's own line, never the model's quote.
- URLs must already appear in the page metadata or JSON-LD.

**Trade-offs:**
- Correct values that are paraphrased are dropped, so fewer fields get filled.
- In return, every value the admin sees can be traced to the page, and a prompt-injected or hallucinated value cannot reach the database.

**Alternatives considered:** Trusting the model's own `evidence_text` (rejected: the quote itself can be invented); fuzzy matching (rejected for now: it reopens the door to paraphrase).


### Decision: Fixed lists for classification fields

**Status:** Decided

**Choice:** `product_kind`, `category`, `industry`, `platforms` and `deployments` take values from fixed lists in `constants/taxonomy.js`.

**Context:** Free-text categories drift ("CRM", "CRM Software", "Customer Relationship Management") and cannot be copied word for word, because pages rarely state "Category: X".

**Decision:** The model picks a label from the list. It is kept only if the page line the model quoted contains one of that label's keywords (whole words; ALL-CAPS keywords such as `HR` must match in capitals). The prompt's list of allowed values is generated from the same file, so the prompt and the verifier cannot disagree.

**Trade-offs:** A consistent catalogue and traceable picks, but a product outside the list leaves the field empty for the admin to fill in. Extending the list is a one-file change.


### Decision: Groq free tier with `openai/gpt-oss-120b`

**Status:** Decided

**Choice:** Groq's OpenAI-compatible API through plain `fetch`, with no SDK.

**Reason:** Free, fast, supports strict JSON-schema output, and the brief does not reimburse API costs. `temperature: 0` and `reasoning_effort: "low"` keep output repeatable and within the 8,000 tokens-per-minute free limit. Page content is capped at about 10,000 characters for the same reason.

**Trade-offs:** Long pages are cut short, and large batches hit rate limits, which are waited out up to a cap. The model can be changed with `GROQ_MODEL`.

**In practice:** the test run used up `gpt-oss-120b`'s daily limit (200,000 tokens), so the recorded results use `openai/gpt-oss-20b`, which has its own limit and supports the same strict schema and settings with no code change. The smaller model missed some fields the larger one finds (for example Zoho Books' category); the verifier keeps it from adding anything the page doesn't say.


### Decision: The app sets `image_type`, and URLs are never built

**Status:** Decided

**Choice:** `image_type` records where the image URL was found (`og:image`, JSON-LD `logo` or `image`). It is a fact the app knows, so the model is not asked for it.

**Reason:** Leaving it to the model would invent a classification. The same thinking applies to `website`, `image_url` and `image_source_page`: they must already appear in the page input.


### Decision: Required fields and lifecycle

**Status:** Decided

**Choice:** `name`, `category` and `short_description` are required for `UNDER_REVIEW`. Without them the product is `DRAFT`. Only the admin can set `ACTIVE`. Rejecting sends the product back to `DRAFT`.

**Reason:** These three are the minimum for a usable catalogue entry. Approval re-checks them on the backend, so the UI cannot bypass the rule.

**Edge case:** With no `name`, no product is created (the database needs one and the app will not invent it). The import record is `PARTIAL` and keeps the extracted data for the admin.


### Decision: Canonical snake_case field names in the database and API

**Status:** Decided

**Choice:** Prisma fields use the canonical names exactly (`sku_id`, `short_description`, `target_customers` and so on), and the API returns them unchanged.

**Reason:** The output maps onto the marketplace records with no translation layer, so there is one less place for a mapping bug.


### Decision: SQLite + Prisma, with no job queue

**Status:** Decided

**Choice:** A local SQLite file and sequential in-process batch processing.

**Reason:** A single admin and a small catalogue. One command creates the database. A queue (BullMQ, Redis) would add setup steps without helping at this scale.

**Trade-offs:** If the server restarts mid-batch, records left in `PROCESSING` are not resumed automatically. This is acceptable for a demo; a startup sweep that resets them to `PENDING` is the planned fix.


### Decision: Record and replay LLM answers for keyless runs

**Status:** Decided

**Choice:** `LLM_MODE` picks the LLM client: live Groq, record (live, plus save the answer per URL), or replay (use the saved answer). With the default `auto`, the app is live when a key is set and replays otherwise.

**Context:** The brief asks for "a way to run the project without an API key, for example recorded responses, so we can try it ourselves".

**Decision:** Record only the model's answer, keyed on the URL the admin pasted. Everything else still runs for real: the page is scraped live, the answer is validated, and every value is verified against the live page. Replayed records carry `recorded:<model>` so the stored data says where the proposal came from.

**Trade-offs:**
- A reviewer can try the full flow with no key, but only on the recorded URLs. Other URLs fail with a clear `NO_RECORDING` message.
- If a vendor page has changed since recording, values it no longer shows are dropped by the verifier. That's the safe direction: a stale recording can lose values, but it can never add them.
- Recording is explicit (`LLM_MODE=record`), so normal live use never rewrites committed files.

**Alternatives considered:** A local model through Ollama (rejected: a large download and extra setup for the reviewer); seed data only (rejected: the reviewer couldn't try an import).


### Decision: Retry with less page text when a request is too large

**Status:** Decided

**Choice:** If Groq answers 413 (the request exceeds the free tier's 8,000 tokens per minute), send it again with 60%, then 36%, of the page text before failing.

**Context:** The system prompt is about 3,500 tokens and page text varies from visit to visit, so a page that fitted once can go over the limit the next time (Zoho Books: 8,391 tokens).

**Reason:** Trimming only affects what the model reads. Its answer is still verified against the full page, so a smaller request can mean fewer fields filled, never invented ones. `extraction.page_text_scale` records how much was sent.

**Alternatives considered:** A permanently smaller page budget (rejected: it loses content on every page, including those that fit).


### Decision: `sku_id` is random, not derived from the name

**Status:** Decided

**Choice:** `PRD-` plus 8 random upper-case hex characters (e.g. `PRD-7F3A09C2`), checked for uniqueness before saving, with a unique index in the database as well.

**Reason:** A SKU must not change when the admin corrects the name, and names extracted from pages are often wrong at first (`jira`, page titles). A random value also avoids collisions between products with similar names. A migration gives existing products a SKU in the same format.

**Trade-off:** The SKU carries no meaning a human can read; the slug does that job.
