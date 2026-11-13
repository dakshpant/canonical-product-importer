// Error codes for the AI step. `code` is what the import processor stores
// in error_message, so an admin can see why a record failed.
export const AI_ERROR = {
  LLM_NOT_CONFIGURED: "LLM_NOT_CONFIGURED",
  LLM_AUTH_FAILED: "LLM_AUTH_FAILED",
  LLM_RATE_LIMITED: "LLM_RATE_LIMITED",
  LLM_TIMEOUT: "LLM_TIMEOUT",
  LLM_NETWORK_ERROR: "LLM_NETWORK_ERROR",
  LLM_PROVIDER_ERROR: "LLM_PROVIDER_ERROR",
  LLM_INPUT_TOO_LARGE: "LLM_INPUT_TOO_LARGE",
  LLM_INVALID_JSON: "LLM_INVALID_JSON",
  LLM_INVALID_OUTPUT: "LLM_INVALID_OUTPUT",
  NO_PRODUCT_DATA: "NO_PRODUCT_DATA",
  NO_RECORDING: "NO_RECORDING",
};

export class AiExtractionError extends Error {
  constructor(code, message, { retryable = false, retryAfterMs, details } = {}) {
    super(message);
    this.name = "AiExtractionError";
    this.code = code;
    this.retryable = retryable;
    if (retryAfterMs !== undefined) this.retryAfterMs = retryAfterMs;
    if (details !== undefined) this.details = details;
  }
}

// Never let a credential reach a log line or an error message.
export function redact(text, apiKey) {
  let safe = String(text ?? "");
  if (apiKey) safe = safe.split(apiKey).join("[REDACTED]");
  return safe.replace(/gsk_[A-Za-z0-9]{8,}/g, "[REDACTED]");
}
