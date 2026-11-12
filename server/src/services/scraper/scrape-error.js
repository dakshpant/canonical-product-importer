// Machine-readable failure reasons for the scrape stage.
// Stored on the ImportRecord so the UI can show why a URL failed.
export const SCRAPE_ERROR = {
  HOST_NOT_ALLOWED: "HOST_NOT_ALLOWED",
  TOO_MANY_REDIRECTS: "TOO_MANY_REDIRECTS",
  REDIRECT_WITHOUT_LOCATION: "REDIRECT_WITHOUT_LOCATION",
  TIMEOUT: "TIMEOUT",
  TOO_LARGE: "TOO_LARGE",
  FETCH_FAILED: "FETCH_FAILED",
  HTTP_404: "HTTP_404",
  ACCESS_DENIED: "ACCESS_DENIED",
  RATE_LIMITED: "RATE_LIMITED",
  HTTP_ERROR: "HTTP_ERROR",
  NOT_HTML: "NOT_HTML",
  JS_RENDERED: "JS_RENDERED",
  INSUFFICIENT_CONTENT: "INSUFFICIENT_CONTENT",
  // robots.txt failures reuse the reason codes from robot.service.js,
  // e.g. DISALLOWED_BY_ROBOTS_TXT, ROBOTS_FETCH_FAILED.
};

export class ScrapeError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "ScrapeError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
