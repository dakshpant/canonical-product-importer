import {
  extractHtmlMetadata,
  extractProductJsonLd,
  extractPageText,
} from "./html-extractor.service.js";
import { fetchProductPage } from "./productPage.service.js";
import { ScrapeError, SCRAPE_ERROR } from "./scrape-error.js";

// JSON-LD budget for the LLM prompt, on top of MAX_TEXT_LENGTH of page text.
export const MAX_JSON_LD_LENGTH = 6000;
const MAX_JSON_LD_NODES = 3;
const MAX_ARRAY_ITEMS = 10;
const MAX_STRING_LENGTH = 1000;
const MAX_DEPTH = 5;

// Keys that are large and carry no canonical product fields.
const DROPPED_JSON_LD_KEYS = new Set([
  "@context",
  "review",
  "reviews",
  "potentialAction",
  "breadcrumb",
  "hasPart",
  "isPartOf",
  "subjectOf",
  "mainEntityOfPage",
]);

// Below this much page text, and with no structured data, there is not
// enough for the LLM to extract a product with real evidence.
export const MIN_USABLE_TEXT_LENGTH = 200;

function trimJsonLdValue(value, depth = 0) {
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return undefined;
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => trimJsonLdValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    if (depth >= MAX_DEPTH) return undefined;
    const trimmed = {};
    for (const [key, child] of Object.entries(value)) {
      if (DROPPED_JSON_LD_KEYS.has(key)) continue;
      const trimmedChild = trimJsonLdValue(child, depth + 1);
      if (trimmedChild !== undefined) trimmed[key] = trimmedChild;
    }
    return trimmed;
  }

  return value;
}

/**
 * Keep the most specific product nodes (already ranked) that fit the
 * budget. The first node is always kept, since it is the best evidence.
 */
function selectJsonLdNodes(nodes) {
  const selected = [];
  let size = 0;

  for (const node of nodes.slice(0, MAX_JSON_LD_NODES)) {
    const trimmed = trimJsonLdValue(node);
    const nodeSize = JSON.stringify(trimmed).length;

    if (selected.length > 0 && size + nodeSize > MAX_JSON_LD_LENGTH) break;

    selected.push(trimmed);
    size += nodeSize;
  }

  return {
    nodes: selected,
    truncated: selected.length < nodes.length,
  };
}

/**
 * Combine every scraped source into one object for the LLM.
 * Sources are kept separate so each extracted field can cite where it came
 * from; evidence quotes must be verbatim substrings of pageText.text.
 */
export function buildProductExtractionInput(html, pageUrl, requestedUrl = pageUrl) {
  const metadata = extractHtmlMetadata(html, pageUrl);
  const jsonLd = selectJsonLdNodes(extractProductJsonLd(html));
  const pageText = extractPageText(html);

  return {
    url: pageUrl,
    requestedUrl,
    metadata,
    jsonLdProducts: jsonLd.nodes,
    pageText,
    signals: {
      hasStructuredData: jsonLd.nodes.length > 0,
      jsonLdTruncated: jsonLd.truncated,
      textLength: pageText.text.length,
      textTruncated: pageText.truncated,
      likelyJsRendered: pageText.likelyJsRendered,
    },
  };
}

/**
 * Throws a ScrapeError when the page has too little content to send to
 * the LLM. Structured data alone is enough to proceed.
 */
export function assertUsableExtractionInput(input) {
  const { hasStructuredData, likelyJsRendered, textLength } = input.signals;

  if (hasStructuredData) return;

  if (likelyJsRendered) {
    throw new ScrapeError(
      SCRAPE_ERROR.JS_RENDERED,
      "Page content is rendered by JavaScript in the browser and could not be read.",
      { textLength },
    );
  }

  if (textLength < MIN_USABLE_TEXT_LENGTH) {
    throw new ScrapeError(
      SCRAPE_ERROR.INSUFFICIENT_CONTENT,
      `Page has too little readable content (${textLength} characters).`,
      { textLength },
    );
  }
}

/**
 * Full scrape stage for one URL: robots.txt check, fetch, extract, check.
 * Returns the object to pass to the LLM, or throws a ScrapeError.
 */
export async function prepareExtractionInput(url) {
  const page = await fetchProductPage(url);
  const input = buildProductExtractionInput(page.html, page.finalUrl, url);

  assertUsableExtractionInput(input);

  return input;
}
