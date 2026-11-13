// Tests for admin edits (PATCH /api/products/:id) validation.
// Pure logic only: no database, no network.
//
// Run: node --test src/test-product-update.js
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatUpdateError,
  productUpdateSchema,
} from "./validators/product-update.validator.js";

const parse = (input) => productUpdateSchema.safeParse(input);
const errorOf = (input) => {
  const result = parse(input);
  assert.equal(result.success, false, "expected validation to fail");
  return formatUpdateError(result.error);
};

test("valid edits pass and text is trimmed", () => {
  const result = parse({ tagline: "  Sell more  ", min_quantity: 1, max_quantity: 10 });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { tagline: "Sell more", min_quantity: 1, max_quantity: 10 });
});

test("clearing a field stores null, never an empty string", () => {
  const result = parse({ overview: "   ", category: null });
  assert.deepEqual(result.data, { overview: null, category: null });
});

test("sku_id, slug, status and unknown fields cannot be edited", () => {
  for (const field of ["sku_id", "slug", "status", "price"]) {
    assert.match(errorOf({ [field]: "x" }), new RegExp(`cannot be edited: ${field}`));
  }
});

test("name cannot be cleared", () => {
  assert.match(errorOf({ name: "   " }), /name: Name is required/);
  assert.match(errorOf({ name: null }), /name: Name is required/);
});

test("lists keep only non-empty text items, without duplicates", () => {
  const result = parse({ features: [" Reports ", "", "Reports", "Pipelines"], tags: null });
  assert.deepEqual(result.data, { features: ["Reports", "Pipelines"], tags: [] });
  assert.match(errorOf({ features: [1, 2] }), /features\.0: List items must be text/);
  assert.match(errorOf({ features: "Reports" }), /features:/);
});

test("URL fields must be full http(s) URLs", () => {
  assert.equal(parse({ website: "https://acme.example/crm" }).success, true);
  assert.equal(parse({ website: "" }).data.website, null);
  assert.match(errorOf({ website: "acme.example" }), /website: Must be a full http\(s\) URL/);
  assert.match(errorOf({ image_url: "javascript:alert(1)" }), /image_url: Must be a full http\(s\) URL/);
});

test("quantities are non-negative numbers and min <= max", () => {
  assert.match(errorOf({ min_quantity: -1 }), /min_quantity: Must be 0 or more/);
  assert.match(errorOf({ min_quantity: "5" }), /min_quantity: Must be a number/);
  assert.match(errorOf({ min_quantity: 10, max_quantity: 5 }), /cannot be greater than max_quantity/);
  assert.equal(parse({ min_quantity: 5, max_quantity: 5 }).success, true);
});

test("an empty edit is refused", () => {
  assert.match(errorOf({}), /at least one field/);
});
