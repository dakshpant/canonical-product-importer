// Minimal Groq chat-completions client: plain fetch against the
// OpenAI-compatible endpoint, with every failure mapped to an AI_ERROR code.
import { GROQ_API_KEY, GROQ_MODEL } from "../../config/env.js";
import { productExtractionJsonSchema } from "../../validators/product-extraction.validator.js";
import { AI_ERROR, AiExtractionError, redact } from "./errors.js";

export const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const REQUEST_TIMEOUT_MS = 60_000;
const MAX_COMPLETION_TOKENS = 4_096;
const MAX_PROVIDER_MESSAGE_LENGTH = 300;

function parseRetryAfter(headers) {
  const value = headers?.get?.("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : undefined;
}

async function readProviderError(response, apiKey) {
  try {
    const body = await response.json();
    return {
      code: body?.error?.code,
      message: redact(body?.error?.message ?? "", apiKey).slice(
        0,
        MAX_PROVIDER_MESSAGE_LENGTH,
      ),
    };
  } catch {
    return { code: undefined, message: "" };
  }
}

// Turn a non-2xx response into the right AiExtractionError.
async function errorFromResponse(response, apiKey) {
  const status = response.status;
  const provider = await readProviderError(response, apiKey);
  const suffix = provider.message ? `: ${provider.message}` : ".";

  if (status === 401 || status === 403) {
    return new AiExtractionError(
      AI_ERROR.LLM_AUTH_FAILED,
      `Groq rejected the API key (HTTP ${status}).`,
    );
  }
  // Request is bigger than the token-per-minute limit; waiting won't help.
  if (status === 413) {
    return new AiExtractionError(
      AI_ERROR.LLM_INPUT_TOO_LARGE,
      `Page content is too large for the model's token limit${suffix}`,
    );
  }
  if (status === 429) {
    return new AiExtractionError(
      AI_ERROR.LLM_RATE_LIMITED,
      `Groq rate limit reached (HTTP 429)${suffix}`,
      { retryable: true, retryAfterMs: parseRetryAfter(response.headers) },
    );
  }
  // The model's output did not match the strict JSON schema.
  if (provider.code === "json_validate_failed") {
    return new AiExtractionError(
      AI_ERROR.LLM_INVALID_OUTPUT,
      `Model output did not match the schema${suffix}`,
      { retryable: true },
    );
  }
  return new AiExtractionError(
    AI_ERROR.LLM_PROVIDER_ERROR,
    `Groq returned HTTP ${status}${suffix}`,
    { retryable: status >= 500 },
  );
}

/**
 * complete(messages) resolves to the assistant's message content (a string).
 * fetchImpl is injectable so tests never make network calls.
 */
export function createGroqClient({
  apiKey = GROQ_API_KEY,
  model = GROQ_MODEL,
  fetchImpl = globalThis.fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (!apiKey) {
    throw new AiExtractionError(
      AI_ERROR.LLM_NOT_CONFIGURED,
      "GROQ_API_KEY is not set. Add it to server/.env.",
    );
  }

  async function complete(messages) {
    let response;
    try {
      response = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          // 0: extraction should give the same answer for the same page.
          temperature: 0,
          max_completion_tokens: MAX_COMPLETION_TOKENS,
          // Extraction needs little reasoning; "low" keeps each request well
          // inside the free-tier token-per-minute limit.
          reasoning_effort: "low",
          include_reasoning: false,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_extraction",
              strict: true,
              schema: productExtractionJsonSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new AiExtractionError(AI_ERROR.LLM_TIMEOUT, "Groq request timed out.", {
          retryable: true,
        });
      }
      throw new AiExtractionError(
        AI_ERROR.LLM_NETWORK_ERROR,
        `Could not reach Groq: ${redact(error?.message, apiKey)}`,
        { retryable: true },
      );
    }

    if (!response.ok) throw await errorFromResponse(response, apiKey);

    let body;
    try {
      body = await response.json();
    } catch {
      throw new AiExtractionError(
        AI_ERROR.LLM_PROVIDER_ERROR,
        "Groq returned a response that is not JSON.",
        { retryable: true },
      );
    }

    const choice = body?.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new AiExtractionError(
        AI_ERROR.LLM_INVALID_OUTPUT,
        "Model output was cut off at the token limit.",
      );
    }

    const content = choice?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new AiExtractionError(
        AI_ERROR.LLM_INVALID_OUTPUT,
        "Model returned an empty response.",
        { retryable: true },
      );
    }
    return content;
  }

  return { model, complete };
}
