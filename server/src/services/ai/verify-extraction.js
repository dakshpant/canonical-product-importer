// The trust boundary for LLM output. The model only proposes; this file
// decides what is kept. Every kept value is found on the page by the app
// itself, and its evidence is the page's own line, never the model's text.
//
//   Copied fields (name, descriptions, features, ...): the value must appear
//     word for word in one place on the page. The website's text is stored.
//   Classification fields (category, platforms, ...): the label must be on the
//     fixed list, and the line the model quoted must contain one of its
//     keywords. The list's label is stored.
//   URLs: must already exist in the page; never constructed.
import { MAPPED_FIELDS, findTaxonomyEntry } from "../../constants/taxonomy.js";
import {
  LIST_FIELDS,
  PRODUCT_EXTRACTION_FIELDS,
  TEXT_FIELDS,
  URL_FIELDS,
} from "../../validators/product-extraction.validator.js";
import {
  METADATA_KEYS,
  buildCopySources,
  collectStrings,
  copyPattern,
  findOnPage,
  keywordPattern,
} from "./text-match.js";

// Why a proposed value was dropped (shown to the admin).
export const DISCARD_REASON = {
  NOT_FOUND_ON_PAGE: "not_found_on_page",
  NOT_IN_ALLOWED_LIST: "not_in_allowed_list",
  EVIDENCE_DOES_NOT_SUPPORT: "evidence_does_not_support",
  URL_NOT_IN_PAGE: "url_not_in_page",
  NO_IMAGE: "no_image",
};

// -> { text, evidence, type } or { reason }
function checkCopied(value, copySources, modelEvidence) {
  const found = findOnPage(copyPattern(value), copySources, modelEvidence);
  return found ?? { reason: DISCARD_REASON.NOT_FOUND_ON_PAGE };
}

function checkMapped(field, value, copySources, modelEvidence) {
  const entry = findTaxonomyEntry(field, value);
  if (!entry) return { reason: DISCARD_REASON.NOT_IN_ALLOWED_LIST };

  const keywords = entry.labelIsKeyword ? [entry.value, ...entry.keywords] : entry.keywords;
  for (const keyword of keywords) {
    const found = findOnPage(keywordPattern(keyword), copySources, modelEvidence, {
      quotedOnly: true,
    });
    if (found) return { ...found, text: entry.value };
  }
  return { reason: DISCARD_REASON.EVIDENCE_DOES_NOT_SUPPORT };
}

const normaliseUrl = (value) => {
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
};

// Every URL in the input, with the section it was found in.
function inputUrls(input) {
  const urls = new Map();
  const add = (value, type) => {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
    const url = normaliseUrl(value);
    if (url && !urls.has(url)) urls.set(url, type);
  };
  [input.url, input.requestedUrl].forEach((u) => add(u, "metadata"));
  METADATA_KEYS.forEach((key) => add(input.metadata?.[key], "metadata"));
  collectStrings(input.jsonLdProducts ?? []).forEach((s) => add(s, "json_ld"));
  return urls;
}

// The URLs the page uses for itself.
function pageUrls(input) {
  return new Set(
    [input.url, input.requestedUrl, input.metadata?.canonicalUrl, input.metadata?.ogUrl]
      .map((u) => (u ? normaliseUrl(u) : null))
      .filter(Boolean),
  );
}

// Where the image URL appears: og:image, or a JSON-LD "logo" / "image".
function findImageOrigin(imageUrl, input) {
  const target = imageUrl ? normaliseUrl(imageUrl) : null;
  if (!target) return null;
  if (normaliseUrl(input.metadata?.ogImage ?? "") === target) {
    return { imageType: "og:image", sourceType: "metadata" };
  }

  let found = null;
  const visit = (value, key) => {
    if (found) return;
    if (typeof value === "string") {
      if ((key === "logo" || key === "image") && normaliseUrl(value) === target) {
        found = { imageType: key, sourceType: "json_ld" };
      }
    } else if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
    } else if (value && typeof value === "object") {
      // { "@type": "ImageObject", "url": "..." } under "logo" / "image"
      for (const [childKey, child] of Object.entries(value)) {
        visit(child, childKey === "url" || childKey === "contentUrl" ? key : childKey);
      }
    }
  };
  visit(input.jsonLdProducts ?? [], null);
  return found;
}

/**
 * Keep only values the app can find on the page.
 * Returns { product, sources, discarded }; sources match ProductSource.
 */
export function verifyExtraction(data, input) {
  const copySources = buildCopySources(input);
  const product = {};
  const sources = [];
  const discarded = [];

  // The model's quotes for a field: used to pick the line, never trusted.
  const modelEvidence = (field) =>
    data.sources
      .filter((s) => s.field_name === field)
      .map((s) => s.evidence_text)
      .join("\n");

  const check = (field, value) =>
    MAPPED_FIELDS.includes(field)
      ? checkMapped(field, value, copySources, modelEvidence(field))
      : checkCopied(value, copySources, modelEvidence(field));

  const addSource = (field, value, evidence, type) =>
    sources.push({
      field_name: field,
      extracted_value: value,
      evidence_text: evidence,
      source_type: type,
      source_url: input.url,
    });

  // 1. URLs must already exist in the input.
  const urls = inputUrls(input);
  const ownUrls = pageUrls(input);
  for (const field of URL_FIELDS) {
    const url = data[field] === null ? null : normaliseUrl(data[field]);
    const allowed = field === "image_source_page" ? ownUrls.has(url) : urls.has(url);
    product[field] = data[field] !== null && allowed ? data[field] : null;
    if (data[field] !== null && !allowed) {
      discarded.push({ field, value: data[field], reason: DISCARD_REASON.URL_NOT_IN_PAGE });
    }
  }

  // An image source page only makes sense with an image.
  if (product.image_url === null) product.image_source_page = null;
  for (const field of URL_FIELDS) {
    if (product[field] !== null) {
      addSource(field, product[field], product[field], urls.get(normaliseUrl(product[field])) ?? "metadata");
    }
  }

  // 2. Text fields. Alt text only makes sense with an image.
  for (const field of TEXT_FIELDS) {
    product[field] = null;
    if (data[field] === null) continue;
    if (field === "image_alt" && product.image_url === null) {
      discarded.push({ field, value: data[field], reason: DISCARD_REASON.NO_IMAGE });
      continue;
    }
    const result = check(field, data[field]);
    if (result.reason) {
      discarded.push({ field, value: data[field], reason: result.reason });
    } else {
      product[field] = result.text;
      addSource(field, result.text, result.evidence, result.type);
    }
  }

  // 3. List fields: each item on its own, duplicates removed.
  for (const field of LIST_FIELDS) {
    product[field] = [];
    const seen = new Set();
    for (const item of data[field]) {
      const result = check(field, item);
      if (result.reason) {
        discarded.push({ field, value: item, reason: result.reason });
        continue;
      }
      const key = result.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      product[field].push(result.text);
      addSource(field, result.text, result.evidence, result.type);
    }
  }

  // 4. image_type is a fact the app knows: where the image URL was found.
  const imageOrigin = findImageOrigin(product.image_url, input);
  product.image_type = imageOrigin?.imageType ?? null;
  if (imageOrigin) {
    addSource("image_type", imageOrigin.imageType, product.image_url, imageOrigin.sourceType);
  }

  const ordered = Object.fromEntries(PRODUCT_EXTRACTION_FIELDS.map((f) => [f, product[f]]));
  return { product: ordered, sources, discarded };
}

