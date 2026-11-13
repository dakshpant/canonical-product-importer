# AI usage note

AI tools were used in two separate ways in this project. They are kept apart below.

## 1. AI inside the product (runtime)

| What | Where | How it is controlled |
| --- | --- | --- |
| Groq `openai/gpt-oss-120b` turns scraped page content into canonical fields | [`server/src/services/ai/`](../server/src/services/ai) | Strict JSON schema, Zod validation, then [`verify-extraction.js`](../server/src/services/ai/verify-extraction.js) keeps only values the app finds on the page. The LLM never sets status, `sku_id`, `slug` or the quantity fields |

The runtime system prompt is [`system.prompt.md`](../server/src/services/ai/system.prompt.md).

## 2. AI coding tools (building the project)

<!-- TODO (author): confirm or correct each row, and add any tool or area missing. -->

| Area | Tool | What the AI did | What I verified myself |
| --- | --- | --- | --- |
| AI extraction layer (`services/ai/`, extraction validator) | Claude Code | Implemented from the brief in [`prompt.md`](../server/src/services/ai/prompt.md), which I wrote to set scope, constraints and the files it could touch | _TODO_ |
| Unit tests (`test-ai-extraction.js`) | Claude Code | _TODO_ | _TODO_ |
| Frontend screens | _TODO_ | _TODO_ | _TODO_ |
| Scraper and network safety | _TODO_ | _TODO_ | _TODO_ |
| Persistence and refresh proposals | _TODO_ | _TODO_ | _TODO_ |
| Documentation (README, architecture, design note) | Claude Code | Drafted from the code and my design decisions | Checked every claim against the code |

## What I checked by hand

<!-- TODO (author): replace with what you actually did. Examples of the kind of thing to list: -->

- _Read every file the tools changed before committing, and can explain each line._
- _Ran `npm test` (58 tests, no network or key needed) and the live script `run-ai-extraction.js` on real pages._
- _Tried to break the verifier: invented values, values stitched from two lines, paraphrases and a prompt injection on a test page._
- _Checked that a refresh never writes a blank over an existing value, and that admin-only fields stay empty._
- _Checked that no API key reaches the logs or error messages._

## Where AI output was wrong or rejected

<!-- TODO (author): note one or two real cases. These are valuable in the walkthrough. -->

- _TODO_
