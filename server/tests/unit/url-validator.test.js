// Tests for URL validation and in-batch de-duplication (the first step of
// every import). No network, no database.
//
// Run: node --test tests/unit/url-validator.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { validateUrlBatch } from "../../src/validators/url.validator.js";

const byUrl = (result) => Object.fromEntries(result.results.map((r) => [r.originalUrl, r]));

test("valid http(s) URLs are accepted and normalised", () => {
  const result = validateUrlBatch(["https://example.com", "http://google.com/path"]);
  assert.equal(result.success, true);
  assert.equal(result.validCount, 2);
  assert.equal(byUrl(result)["https://example.com"].normalizedUrl, "https://example.com/");
});

test("non-URLs and non-http schemes are rejected with a reason", () => {
  const r = byUrl(validateUrlBatch(["not-a-url", "ftp://example.com", "javascript:alert(1)"]));
  for (const url of ["not-a-url", "ftp://example.com", "javascript:alert(1)"]) {
    assert.equal(r[url].isValid, false, `${url} must be rejected`);
    assert.ok(r[url].error, `${url} needs a reason`);
  }
});

test("the same page twice in one batch is flagged as a duplicate (fragments ignored)", () => {
  const result = validateUrlBatch([
    "https://example.com",
    "https://example.com#overview",
    "https://example.com#features",
  ]);
  const [first, second, third] = result.results;
  assert.equal(first.isDuplicate, false);
  assert.equal(second.isDuplicate, true);
  assert.equal(second.duplicateOf, 0);
  assert.equal(third.isDuplicate, true);
  assert.equal(result.duplicateCount, 2);
});

test("a non-array input is refused", () => {
  assert.equal(validateUrlBatch("https://example.com").success, false);
});
