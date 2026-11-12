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