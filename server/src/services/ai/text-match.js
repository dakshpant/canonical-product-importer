// Finding text on the scraped page. Every value the app keeps must be found
// here, in ONE place: one line of page text, one metadata value, or one
// JSON-LD string. Nothing is ever stitched together across places.

export const METADATA_KEYS = [
  "title",
  "description",
  "canonicalUrl",
  "ogTitle",
  "ogDescription",
  "ogImage",
  "ogUrl",
];

const MAX_SHOWN_EVIDENCE = 300;
const MIN_FRAGMENT_LENGTH = 3;

// For comparing text: ignores case, spacing, quote/dash styles, "..." vs "…",
// and the "# " / "- " markers our extractor puts on headings and list items.
export function normaliseForMatch(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/^[ \t]*[#-][ \t]+/gm, "")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "number" || typeof value === "boolean") out.push(String(value));
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object")
    Object.values(value).forEach((item) => collectStrings(item, out));
  return out;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

const WORD_START = "(?<![\\p{L}\\p{N}])";
const WORD_END = "(?![\\p{L}\\p{N}])";
const SINGLE_QUOTES = "['\\u2018\\u2019\\u201A\\u201B\\u2032]";
const DOUBLE_QUOTES = '["\\u201C-\\u201F\\u2033]';
const DASHES = "[\\-\\u2010-\\u2015\\u2212]";
const ELLIPSIS = "(?:\\u2026|\\.\\.\\.)";

function charPattern(ch) {
  if (/['‘-‛′]/.test(ch)) return SINGLE_QUOTES;
  if (/["“-‟″]/.test(ch)) return DOUBLE_QUOTES;
  if (/[-‐-―−]/.test(ch)) return DASHES;
  return ch.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}

// Regex source for `text`, tolerant only of spacing, quote/dash styles and
// "..." vs "…". Everything else must match character for character.
function excerptSource(text) {
  const value = String(text ?? "").trim();
  let pattern = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (/\s/.test(ch)) {
      while (i + 1 < value.length && /\s/.test(value[i + 1])) i += 1;
      pattern += "\\s+";
    } else if (ch === "…") {
      pattern += ELLIPSIS;
    } else if (value.startsWith("...", i)) {
      pattern += ELLIPSIS;
      i += 2;
    } else {
      pattern += charPattern(ch);
    }
  }
  return pattern;
}

/**
 * A copied value: a continuous excerpt, ignoring case, that starts and ends
 * on word boundaries ("Software" is not a copy of "SoftwareApplication").
 */
export function copyPattern(value) {
  return new RegExp(`${WORD_START}${excerptSource(value)}${WORD_END}`, "iu");
}

/**
 * A taxonomy keyword: whole words, optional plural, ignoring case, except
 * ALL-CAPS keywords (CRM, HR, API) which must appear in capitals.
 */
export function keywordPattern(keyword) {
  const caseSensitive = /^[A-Z0-9/&+-]{2,}$/.test(keyword);
  return new RegExp(
    `${WORD_START}${excerptSource(keyword)}(?:e?s)?${WORD_END}`,
    caseSensitive ? "u" : "iu",
  );
}

// ---------------------------------------------------------------------------
// Searching the page
// ---------------------------------------------------------------------------

/** Every place a value may come from, with the section it belongs to. */
export function buildCopySources(input) {
  const lines = String(input.pageText?.text ?? "")
    .split("\n")
    .map((line) => line.replace(/^[ \t]*[#-][ \t]+/, "").trim())
    .filter(Boolean)
    .map((text) => ({ type: "page_text", text }));

  const metadata = METADATA_KEYS.map((key) => input.metadata?.[key])
    .filter((text) => typeof text === "string" && text.trim())
    .map((text) => ({ type: "metadata", text }));

  const jsonLd = collectStrings(input.jsonLdProducts ?? []).map((text) => ({
    type: "json_ld",
    text,
  }));

  return [...jsonLd, ...metadata, ...lines].map((source) => ({
    ...source,
    normalised: normaliseForMatch(source.text),
  }));
}

// Pieces of the model's quote: the whole quote, each line of it, and any
// "quoted" JSON values (the model often quotes JSON-LD as raw JSON). Key
// names (a quoted string followed by ":") are skipped.
function quoteFragments(evidence) {
  const raw = String(evidence ?? "");
  const jsonValues = [...raw.matchAll(/"((?:[^"\\]|\\.)*)"(?!\s*:)/g)].map((m) => m[1]);
  return [raw, ...raw.split("\n"), ...jsonValues]
    .map(normaliseForMatch)
    .filter((fragment) => fragment.length >= MIN_FRAGMENT_LENGTH);
}

// A long line is cut to a window around the match, on word boundaries.
function windowAround(text, index, length) {
  if (text.length <= MAX_SHOWN_EVIDENCE) return text;
  const spare = Math.max(0, MAX_SHOWN_EVIDENCE - length);
  let start = Math.max(0, index - Math.floor(spare / 2));
  let end = Math.min(text.length, index + length + Math.ceil(spare / 2));
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  if (end < text.length) end = text.lastIndexOf(" ", end) || end;
  return text.slice(start, end).trim();
}

/**
 * Find `pattern` in one copy source. Sources the model quoted (its
 * evidence text) are tried first, so the admin sees the line the model used.
 * With quotedOnly, only those sources count.
 *
 * Returns { text, evidence, type }: the matched text exactly as the website
 * wrote it, the line it is on (for the admin), and the section; or null.
 */
export function findOnPage(pattern, sources, modelEvidence, { quotedOnly = false } = {}) {
  const fragments = quoteFragments(modelEvidence);
  const quoted = (source) =>
    fragments.some((f) => source.normalised.includes(f) || f.includes(source.normalised));

  const preferred = sources.filter(quoted);
  const preferredSet = new Set(preferred);
  const ordered = quotedOnly
    ? preferred
    : [...preferred, ...sources.filter((s) => !preferredSet.has(s))];

  for (const source of ordered) {
    const match = source.text.match(pattern);
    if (match) {
      return {
        text: match[0].replace(/\s+/g, " ").trim(),
        evidence: windowAround(source.text, match.index, match[0].length),
        type: source.type,
      };
    }
  }
  return null;
}
