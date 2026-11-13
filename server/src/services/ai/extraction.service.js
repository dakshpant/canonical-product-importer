// AI step of the import: page content in, verified canonical product out.
//
//   buildExtractionMessages -> Groq (groq.client.js) -> JSON + Zod validation
//   -> verifyExtraction (verify-extraction.js) -> { status, data }
//
// The LLM only proposes. Nothing it returns is kept unless the app finds it
// on the page itself.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { IMPORT_STATUS } from "../../constants/status.js";
import { MAPPED_FIELDS, TAXONOMY } from "../../constants/taxonomy.js";
import {
  PRODUCT_EXTRACTION_FIELDS,
  formatValidationIssues,
  validateProductExtraction,
} from "../../validators/product-extraction.validator.js";
import { AI_ERROR, AiExtractionError } from "./errors.js";
import { createLlmClient } from "./recorded.client.js";
import { METADATA_KEYS } from "./text-match.js";
import { verifyExtraction } from "./verify-extraction.js";

export { AI_ERROR, AiExtractionError } from "./errors.js";
export { GROQ_CHAT_COMPLETIONS_URL, createGroqClient } from "./groq.client.js";
export { copyPattern, keywordPattern, normaliseForMatch } from "./text-match.js";
export { DISCARD_REASON, verifyExtraction } from "./verify-extraction.js";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

// HTML comments (e.g. an older prompt kept for reference) are stripped so
// they are never sent to the model. The allowed lists are appended from
// constants/taxonomy.js, so the prompt and the verifier always agree.
const PROMPT_FILE = readFileSync(
  fileURLToPath(new URL("./system.prompt.md", import.meta.url)),
  "utf8",
)
  .replace(/<!--[\s\S]*?-->/g, "")
  .trim();

const ALLOWED_VALUES_SECTION = [
  "# Allowed values for classification fields",
  "",
  "Use exactly one of these labels (or `null` / `[]`). Each pick needs an `evidence_text` copied from the input that clearly states it.",
  "",
  ...MAPPED_FIELDS.map(
    (field) => `- \`${field}\`: ${TAXONOMY[field].map((e) => `"${e.value}"`).join(", ")}`,
  ),
].join("\n");

export const SYSTEM_PROMPT = `${PROMPT_FILE}\n\n${ALLOWED_VALUES_SECTION}`;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 2; // one retry for transient failures / invalid output
const MAX_RATE_LIMIT_WAITS = 3; // rate-limit waits don't use up MAX_ATTEMPTS
const RETRY_DELAY_MS = 1_000;
const MAX_RETRY_AFTER_MS = 60_000; // longer rate-limit waits fail the record instead

// Groq's free tier allows 8,000 tokens per minute, input and output
// together, so the page content sent to the model is capped (~4 chars/token).
const MAX_USER_CONTENT_CHARS = 10_000;
const MIN_PAGE_TEXT_CHARS = 3_000;

// Missing any of these makes the import record PARTIAL (it is still saved).
export const REQUIRED_FIELDS = ["name", "category", "short_description"];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function truncateAtLine(text, maxLength) {
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf("\n", maxLength);
  return text.slice(0, cut > 0 ? cut : maxLength);
}

/** Chat messages from the scraper's bounded input. Raw HTML is never sent. */
export function buildExtractionMessages(input) {
  const metadata = Object.fromEntries(
    METADATA_KEYS.map((key) => [key, input.metadata?.[key] ?? null]),
  );
  const jsonLd = input.jsonLdProducts ?? [];
  const fixedChars = JSON.stringify(metadata).length + JSON.stringify(jsonLd).length;
  const textBudget = Math.max(MIN_PAGE_TEXT_CHARS, MAX_USER_CONTENT_CHARS - fixedChars);
  const fullText = input.pageText?.text ?? "";
  const pageText = truncateAtLine(fullText, textBudget);

  const payload = {
    page_url: input.url,
    requested_url: input.requestedUrl ?? input.url,
    metadata,
    json_ld: jsonLd,
    page_text: pageText,
    page_text_truncated: Boolean(input.pageText?.truncated) || pageText.length < fullText.length,
  };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(payload) },
  ];
}

// ---------------------------------------------------------------------------
// Parsing and validation
// ---------------------------------------------------------------------------

export function parseModelJson(content) {
  // Strict mode should return bare JSON; strip fences defensively anyway.
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(text);
  } catch {
    throw new AiExtractionError(AI_ERROR.LLM_INVALID_JSON, "Model response is not valid JSON.", {
      retryable: true,
    });
  }
}

function validateOrThrow(parsed) {
  const result = validateProductExtraction(parsed);
  if (!result.success) {
    throw new AiExtractionError(
      AI_ERROR.LLM_INVALID_OUTPUT,
      `Model output failed validation: ${formatValidationIssues(result.error)}`,
      { retryable: true },
    );
  }
  return result.data;
}

const hasAnyValue = (product) =>
  PRODUCT_EXTRACTION_FIELDS.some((field) =>
    Array.isArray(product[field]) ? product[field].length > 0 : product[field] !== null,
  );

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ask the model until it returns valid output. Invalid output and transient
// errors get one retry; rate limits are waited out separately (capped).
async function requestValidOutput(client, messages, sleep) {
  let attempts = 0;
  let rateLimitWaits = 0;

  for (;;) {
    try {
      attempts += 1;
      return validateOrThrow(parseModelJson(await client.complete(messages)));
    } catch (error) {
      if (!(error instanceof AiExtractionError) || !error.retryable) throw error;

      if (error.code === AI_ERROR.LLM_RATE_LIMITED) {
        const delay = error.retryAfterMs ?? RETRY_DELAY_MS;
        if (rateLimitWaits >= MAX_RATE_LIMIT_WAITS || delay > MAX_RETRY_AFTER_MS) throw error;
        rateLimitWaits += 1;
        attempts -= 1;
        await sleep(delay);
        continue;
      }

      if (attempts >= MAX_ATTEMPTS) throw error;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

/**
 * AI step for the import processor: processImportBatch(batchId, { extractProduct }).
 * Returns { status: "SUCCESS" | "PARTIAL", data } where data is stored as
 * ImportRecord.extracted_data. Never decides approval or lifecycle status.
 * Throws AiExtractionError (with a `code`) on failure.
 *
 * options.client: { model, complete(messages) } — inject a fake in tests.
 * Otherwise the client is chosen by LLM_MODE (live Groq, record or replay;
 * see recorded.client.js). Recordings are keyed on the URL the admin pasted.
 */
export async function extractProduct(input, _record, options = {}) {
  const client = options.client ?? createLlmClient(input.requestedUrl ?? input.url);
  const sleep = options.sleep ?? defaultSleep;

  const proposed = await requestValidOutput(client, buildExtractionMessages(input), sleep);
  const { product, sources, discarded } = verifyExtraction(proposed, input);

  if (!hasAnyValue(product)) {
    throw new AiExtractionError(
      AI_ERROR.NO_PRODUCT_DATA,
      "No product information supported by the page could be extracted.",
      { details: { discarded } },
    );
  }

  const missingRequiredFields = REQUIRED_FIELDS.filter((field) => product[field] === null);

  return {
    status: missingRequiredFields.length > 0 ? IMPORT_STATUS.PARTIAL : IMPORT_STATUS.SUCCESS,
    data: {
      product,
      sources,
      review: { missing_required_fields: missingRequiredFields, discarded },
      extraction: {
        model: client.model ?? null,
        page_url: input.url,
        requested_url: input.requestedUrl ?? input.url,
        extracted_at: new Date().toISOString(),
      },
    },
  };
}
