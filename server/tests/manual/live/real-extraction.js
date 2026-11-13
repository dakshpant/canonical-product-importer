import assert from "node:assert/strict";

import { fetchProductPage } from "../../../src/services/scraper/productPage.service.js";

import { buildProductExtractionInput } from "../../../src/services/scraper/product-extraction-input.service.js";

const url = "https://www.postman.com/";

try {
  // 1. Fetch the actual webpage
  const page = await fetchProductPage(url);

  console.log("Page fetched successfully!");
  console.log("Final URL:", page.finalUrl);

  // 2. Extract information from the downloaded HTML
  const extractionInput = buildProductExtractionInput(page.html, page.finalUrl);

  // 3. Verify the extraction output
  assert.ok(extractionInput.metadata);
  assert.ok(Array.isArray(extractionInput.jsonLdProducts));
  assert.ok(extractionInput.pageText);

  assert.equal(extractionInput.url, page.finalUrl);

  console.log("\nExtraction successful!");
  console.dir(extractionInput, { depth: null });
} catch (error) {
  console.error("Extraction failed:", error.message);
  process.exitCode = 1;
}
