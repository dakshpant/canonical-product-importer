// Status values mirror server/src/constants/status.js.

export const PRODUCT_STATUS = {
  DRAFT: 'DRAFT',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACTIVE: 'ACTIVE',
}

export const BATCH_DONE = ['COMPLETED', 'PARTIAL', 'FAILED']
export const RECORD_DONE = ['SUCCESS', 'PARTIAL', 'FAILED']

const TONES = {
  neutral: 'bg-stone-100 text-stone-600 ring-stone-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
}

const STATUS_META = {
  // Product
  DRAFT: { label: 'Draft', tone: 'neutral' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'success' },
  // Batch / record
  PENDING: { label: 'Queued', tone: 'neutral' },
  PROCESSING: { label: 'Processing', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  SUCCESS: { label: 'Success', tone: 'success' },
  PARTIAL: { label: 'Partial', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
}

export function statusMeta(status) {
  const meta = STATUS_META[status] ?? { label: status ?? 'Unknown', tone: 'neutral' }
  return { ...meta, className: TONES[meta.tone] }
}

export function toneClass(tone) {
  return TONES[tone] ?? TONES.neutral
}

// ---------------------------------------------------------------------------
// Failure reasons. The backend stores error_message as "CODE: message".
// ---------------------------------------------------------------------------

const ERROR_HINTS = {
  DISALLOWED_BY_ROBOTS_TXT: 'The site’s robots.txt does not allow this page to be scraped. Enter it by hand.',
  ROBOTS_FETCH_FAILED: 'robots.txt could not be checked, so the page was not scraped. Try again later.',
  ROBOTS_UNAVAILABLE: 'robots.txt could not be checked, so the page was not scraped. Try again later.',
  ROBOTS_HTTP_ERROR: 'robots.txt returned an error, so the page was not scraped.',
  ROBOTS_ACCESS_FORBIDDEN: 'The site blocks access to robots.txt, so the page was not scraped.',
  HOST_NOT_ALLOWED: 'The address is private or not allowed. Only public pages can be imported.',
  TIMEOUT: 'The site took too long to respond. Retry later.',
  FETCH_FAILED: 'The page could not be reached. Check the URL.',
  HTTP_404: 'The page does not exist (404). Check the URL.',
  ACCESS_DENIED: 'The site refused the request (blocked or login required).',
  RATE_LIMITED: 'The site is rate limiting requests. Retry later.',
  HTTP_ERROR: 'The site returned an error.',
  NOT_HTML: 'The URL is not a web page.',
  JS_RENDERED: 'The page only renders with JavaScript, which is not supported yet.',
  INSUFFICIENT_CONTENT: 'The page has too little text to extract a product from.',
  TOO_LARGE: 'The page is too large to process.',
  TOO_MANY_REDIRECTS: 'The URL redirects too many times.',
  REDIRECT_WITHOUT_LOCATION: 'The site sent a broken redirect.',
  LLM_NOT_CONFIGURED: 'No AI provider is configured on the server.',
  LLM_AUTH_FAILED: 'The AI provider rejected the API key.',
  LLM_RATE_LIMITED: 'The AI provider is rate limiting requests. Retry later.',
  LLM_TIMEOUT: 'The AI provider timed out. Retry later.',
  LLM_NETWORK_ERROR: 'The AI provider could not be reached.',
  LLM_PROVIDER_ERROR: 'The AI provider returned an error.',
  LLM_INVALID_JSON: 'The AI returned unreadable output; nothing was saved.',
  LLM_INVALID_OUTPUT: 'The AI output failed validation; nothing was saved.',
  NO_PRODUCT_DATA: 'No product information backed by the page could be found.',
}

export function parseError(errorMessage) {
  if (!errorMessage) return null
  const match = /^([A-Z0-9_]+):\s*([\s\S]*)$/.exec(errorMessage)
  const code = match ? match[1] : null
  const message = match ? match[2] : errorMessage
  return { code, message, hint: code ? ERROR_HINTS[code] : null }
}
