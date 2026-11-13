# Design note

**Goal:** move the admin from typing ~25 fields per product to checking pre-filled fields against their source, without ever showing them a value the page does not support.

## Key decisions

1. **The LLM proposes, the backend decides.** Groq returns JSON in a strict schema, with a quote for each value. Zod checks the shape. Then the app searches for each value on the page itself: copied text must appear word for word in one place, and URLs must already be in the page's metadata. Anything else is dropped and listed with a reason. The evidence shown to the admin is the page's own line, not the model's quote.
2. **Fixed lists for classification.** `category`, `industry`, `product_kind`, `platforms` and `deployments` come from fixed lists. A pick is kept only if the quoted page line contains one of that value's keywords. This keeps the catalogue consistent and every pick traceable.
3. **The app owns what it knows.** `slug` (and `sku_id`) are generated. `image_type` comes from where the image was found. `unit_of_measure`, `min_quantity` and `max_quantity` are never extracted.
4. **Refresh never overwrites.** Re-importing a known URL creates a proposal that holds only the non-empty new values. The admin chooses field by field, and a blank can never replace a value.
5. **Contain every failure.** Each URL is its own record with a status and a `CODE: message` reason. One failure never stops the batch. LLM calls retry transient errors and wait out rate limits.
6. **Safe scraping.** robots.txt is checked first, and if it can't be read the page is skipped. Only public IPs are allowed, the connection is pinned to the checked IP, and limits apply to time, size and redirects.
7. **Simple runtime.** SQLite, Prisma and sequential processing: one command sets everything up, and behaviour is predictable.

## Trade-offs

| Choice | Gain | Cost |
| --- | --- | --- |
| Exact-match verification | No invented or paraphrased values | Some correct values are dropped, so fewer fields are filled |
| Fixed lists | Consistent and comparable categories | Products outside the list need manual input |
| Free Groq tier | No cost | ~10k characters of page per call; rate limits on big batches |
| Plain HTTP fetch | Fast, simple, safe | JavaScript-only pages come back thin |
| Sequential batches | Simple, polite to vendors | Slower for large batches |
| Skip the page if robots.txt is unreadable | Never scrapes against the owner's wishes | Some reachable pages are refused |

## What I would build next for the admin

1. **Confidence and one-click accept.** Mark fields matched in JSON-LD or metadata as high confidence and let the admin accept them all at once.
2. **Learn from edits and rejections.** Feed common corrections back into the taxonomy keywords and the prompt.
3. **JavaScript rendering fallback.** Use a headless browser only when the plain fetch returns thin content.
4. **Product family import.** Start from a parent URL, discover the child product pages, and import them as one batch.
5. **Change detection.** Store a hash of the page content and propose a refresh when it changes.
6. **Resumable batches.** Reset records stuck in `PROCESSING` after a restart, and allow limited concurrency across different domains.
