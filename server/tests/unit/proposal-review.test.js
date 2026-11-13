// Tests for applying a refresh proposal (the "never destroy good data" rules).
// Pure logic only: no database, no network.
//
// Run: node --test src/test-proposal-review.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildProposalUpdate } from "./services/product/proposal-update.js";

const proposed = {
  tagline: "New tagline",
  short_description: "New description",
  features: ["Pipelines", "Reports"],
  overview: "   ",
  tags: [],
  industry: null,
};

const status400 = (fn, pattern) =>
  assert.throws(fn, (error) => error.statusCode === 400 && pattern.test(error.message));

test("applies only fields the admin set to 'proposed'", () => {
  const { updates, applied } = buildProposalUpdate(proposed, {
    tagline: "proposed",
    short_description: "current",
    features: "proposed",
  });
  assert.deepEqual(updates, { tagline: "New tagline", features: ["Pipelines", "Reports"] });
  assert.deepEqual(applied, ["tagline", "features"]);
});

test("'current' never changes anything", () => {
  const { updates, applied } = buildProposalUpdate(proposed, {
    tagline: "current",
    features: "current",
  });
  assert.deepEqual(updates, {});
  assert.deepEqual(applied, []);
});

test("a blank, whitespace, null, empty-list or missing new value is never applied", () => {
  const { updates, applied } = buildProposalUpdate(proposed, {
    overview: "proposed", // whitespace only
    tags: "proposed", // []
    industry: "proposed", // null
    category: "proposed", // not in the proposal at all
  });
  assert.deepEqual(updates, {});
  assert.deepEqual(applied, []);
});

test("app-owned and admin-only fields are refused", () => {
  for (const field of ["sku_id", "slug", "status", "unit_of_measure", "min_quantity", "max_quantity"]) {
    status400(
      () => buildProposalUpdate({ [field]: "x" }, { [field]: "proposed" }),
      /cannot be changed by a refresh/,
    );
  }
});

test("unknown fields are refused", () => {
  status400(() => buildProposalUpdate(proposed, { price: "proposed" }), /Unknown field: price/);
});

test("decision values other than 'current' / 'proposed' are refused", () => {
  status400(() => buildProposalUpdate(proposed, { tagline: "yes" }), /must be "current" or "proposed"/);
  status400(() => buildProposalUpdate(proposed, { tagline: true }), /must be "current" or "proposed"/);
});

test("decisions must be an object", () => {
  for (const bad of [undefined, null, "tagline", ["tagline"]]) {
    status400(() => buildProposalUpdate(proposed, bad), /decisions must be an object/);
  }
});

test("legacy keys stored in proposed_data are ignored", () => {
  // Proposals saved before the snake_case migration used camelCase keys.
  const { updates } = buildProposalUpdate(
    { shortDescription: "Old-style key" },
    { short_description: "proposed" },
  );
  assert.deepEqual(updates, {});
});

test("an invalid proposal payload is treated as having no new values", () => {
  for (const bad of [null, "text", ["a"]]) {
    const { updates } = buildProposalUpdate(bad, { tagline: "proposed" });
    assert.deepEqual(updates, {});
  }
});
