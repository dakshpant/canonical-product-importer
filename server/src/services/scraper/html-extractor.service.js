import * as cheerio from "cheerio";
function resolveUrl(value, baseUrl) {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

export function extractHtmlMetadata(html, pageUrl) {
  const $ = cheerio.load(html);

  const getMetaContent = (selector) => {
    return $(selector).attr("content")?.trim() || null;
  };

  const metadata = {
    title:
      $("title").first().text().trim() ||
      getMetaContent('meta[property="og:title"]'),

    description:
      getMetaContent('meta[name="description"]') ||
      getMetaContent('meta[property="og:description"]'),

    canonicalUrl: $('link[rel="canonical"]').attr("href") || null,

    ogTitle: getMetaContent('meta[property="og:title"]'),

    ogDescription: getMetaContent('meta[property="og:description"]'),

    ogImage: getMetaContent('meta[property="og:image"]'),

    ogUrl: getMetaContent('meta[property="og:url"]'),

    pageUrl,
  };

  // Convert relative URLs into absolute URLs.
  metadata.canonicalUrl = resolveUrl(metadata.canonicalUrl, pageUrl);

  metadata.ogImage = resolveUrl(metadata.ogImage, pageUrl);

  metadata.ogUrl = resolveUrl(metadata.ogUrl, pageUrl);

  return metadata;
}

export function extractJsonLd(html) {
  const $ = cheerio.load(html);
  const structuredData = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const rawJson = $(element).text().trim();

    if (!rawJson) return;

    try {
      const parsedData = JSON.parse(rawJson);
      structuredData.push(parsedData);
    } catch (error) {
      console.warn("Invalid JSON-LD found:", error.message);
    }
  });

  return structuredData;
}

// schema.org types that describe a B2B software product, most specific first.
// The order is used to rank matches when a page has more than one.
export const PRODUCT_TYPES = [
  "WebApplication",
  "MobileApplication",
  "SoftwareApplication",
  "IndividualProduct",
  "Product",
  "ProductGroup",
  "Service",
];

// "https://schema.org/SoftwareApplication" or "schema:SoftwareApplication"
// -> "SoftwareApplication"
function normalizeType(type) {
  if (typeof type !== "string") return null;
  return type.replace(/^(https?:\/\/schema\.org\/|schema:)/i, "").trim();
}

function typesOf(node) {
  const raw = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  return raw.map(normalizeType).filter(Boolean);
}

// Collect every typed node, whatever the shape: a single object,
// a top-level array, a (nested) @graph, or a WebPage's mainEntity.
function flattenJsonLd(data) {
  const nodes = [];

  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (!item || typeof item !== "object") return;

    if (item["@graph"]) visit(item["@graph"]);
    if (item["@type"]) nodes.push(item);
    if (item.mainEntity) visit(item.mainEntity);
  };

  visit(data);
  return nodes;
}

// Lower rank = more specific product type.
function productRank(node) {
  const ranks = typesOf(node)
    .map((type) => PRODUCT_TYPES.indexOf(type))
    .filter((index) => index !== -1);

  return ranks.length ? Math.min(...ranks) : -1;
}

export function extractProductJsonLd(html) {
  return flattenJsonLd(extractJsonLd(html))
    .filter((node) => productRank(node) !== -1)
    .sort((a, b) => productRank(a) - productRank(b));
}

// Keeps the LLM prompt inside free-tier context limits.
export const MAX_TEXT_LENGTH = 15000;

// If <main> yields less than this, it is probably just a hero banner,
// so fall back to the whole <body>.
const MIN_MAIN_TEXT_LENGTH = 200;

// Elements that never hold product information.
const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "footer",
  "aside",
  "form",
  "dialog",
  "[hidden]",
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
].join(", ");

// Cookie / consent banners. Matched loosely, so they are only removed
// when small, to avoid deleting a page wrapper like class="has-cookie-bar".
const BANNER_SELECTORS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
].join(", ");
const MAX_BANNER_TEXT_LENGTH = 500;

const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6";

// Elements that start a new line in the rendered page.
const BLOCK_SELECTORS = [
  HEADING_SELECTORS,
  "p",
  "li",
  "div",
  "section",
  "article",
  "main",
  "blockquote",
  "pre",
  "tr",
  "td",
  "th",
  "dt",
  "dd",
  "figcaption",
  "summary",
].join(", ");

// Mount points left empty by client-side frameworks (React, Vue, Next, Nuxt).
const APP_ROOT_SELECTORS = "#root, #app, #__next, #__nuxt, [data-reactroot]";

function toLines(element) {
  return element
    .text()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function truncateAtLine(text, maxLength) {
  if (text.length <= maxLength) return text;

  const cut = text.lastIndexOf("\n", maxLength);
  return text.slice(0, cut > 0 ? cut : maxLength);
}

/**
 * Readable, line-structured text of a page's main content.
 * Headings are prefixed with "# " and list items with "- " so the LLM can
 * see sections and feature lists. The returned text is also what extracted
 * evidence quotes are verified against.
 *
 * Returns { text, truncated, likelyJsRendered }.
 */
export function extractPageText(html) {
  const $ = cheerio.load(html || "");
  const body = $("body");

  // Check before cleaning: the mount point is still present.
  const hasAppRoot = $(APP_ROOT_SELECTORS).length > 0;

  // 1. Remove noise.
  body.find(NOISE_SELECTORS).remove();

  body.find(BANNER_SELECTORS).each((_, el) => {
    if ($(el).text().trim().length <= MAX_BANNER_TEXT_LENGTH) {
      $(el).remove();
    }
  });

  // 2. Keep structure: markers for headings and list items,
  //    and a line break after every block element.
  body.find(HEADING_SELECTORS).each((_, el) => {
    $(el).prepend("# ");
  });

  body.find("li").each((_, el) => {
    $(el).prepend("- ");
  });

  body.find("br").replaceWith("\n");

  body.find(BLOCK_SELECTORS).each((_, el) => {
    $(el).append("\n");
  });

  // 3. Prefer <main>, unless it only holds a small fragment of the page.
  const main = body.find('main, [role="main"]');
  const mainLines = main.length ? toLines(main) : [];
  const useMain = mainLines.join("\n").length >= MIN_MAIN_TEXT_LENGTH;
  const lines = useMain ? mainLines : toLines(body);

  // 4. Drop repeated lines (menus, repeated CTAs), keeping the first.
  const fullText = [...new Set(lines)].join("\n");
  const text = truncateAtLine(fullText, MAX_TEXT_LENGTH);

  return {
    text,
    truncated: text.length < fullText.length,
    likelyJsRendered: hasAppRoot && fullText.length < MIN_MAIN_TEXT_LENGTH,
  };
}
