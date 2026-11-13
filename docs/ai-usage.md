# AI Usage Note

AI tools were used in two separate ways during this project: as part of the product's runtime extraction workflow and as development assistants. These uses are documented separately below.

## 1. AI inside the product (runtime)

| What                                                                                                  | Where                     | How it is controlled                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Groq (`openai/gpt-oss-120b`) converts scraped webpage content into proposed canonical product fields. | `server/src/services/ai/` | The response is parsed and validated using the extraction schema. `verify-extraction.js` checks proposed values against the scraped page and discards unsupported values. The LLM cannot set product status, `sku_id`, `slug`, or admin-only quantity fields. |

The runtime system prompt is maintained in `server/src/services/ai/system.prompt.md`.

## 2. AI coding tools (building the project)

| Area                               | Tool        | What AI helped with                                                                                          | What I verified                                                                                 |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| AI extraction layer and validation | Claude Code | Assisted with implementing the extraction workflow and validation logic based on the project brief.          | Reviewed extraction logic, schema validation and evidence verification.                         |
| Unit tests                         | ChatGPT     | Helped identify important test cases, reason through expected behaviour and troubleshoot test failures.      | Ran the test suite and reviewed failures.                                                       |
| Frontend screens                   | ChatGPT     | Helped with frontend workflow implementation and debugging import, product review and proposal interactions. | Manually tested import, product review and proposal workflows.                                  |
| Scraper and network safety         | ChatGPT     | Helped review URL validation, scraping behaviour and network-safety edge cases.                              | Tested URL validation, blocked destinations and scraping failures.                              |
| Persistence and refresh proposals  | ChatGPT     | Helped reason through product persistence, proposal creation and admin review behaviour.                     | Checked that refreshes create proposals rather than silently overwriting existing product data. |
| Documentation                      | Claude Code | Assisted with drafting documentation from the implementation and design decisions.                           | Checked documentation claims against the actual implementation.                                 |

## 3. What I checked manually

- Ran the backend test suite and reviewed test failures.
- Tested product import and inspected saved records in SQLite.
- Checked that unsupported or missing extraction values are not treated as verified facts.
- Tested that product approval is blocked when required fields are missing.
- Tested that application-owned fields cannot be changed through the ordinary product update API.
- Tested that rejecting a refresh proposal preserves the existing product values.
- Tested that product-level rejection moves the product back to `DRAFT`.
- Checked that API failures are reported as failed imports rather than incorrectly creating approved products.

## 4. Where AI output was wrong or rejected

- Some imports failed with `LLM_RATE_LIMITED` because the Groq provider temporarily restricted requests. These were recorded as import failures rather than successful extractions.
- [Add a real example of an unsupported or unverified field discarded by the verifier, if you have one.]

## 5. Responsibility

AI tools assisted with implementation, debugging and documentation. I reviewed and tested the resulting application. The extraction output remains subject to validation and evidence verification, and the final product approval decision remains with the human administrator.
