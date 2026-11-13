// Tests for app-generated identifiers (sku_id). No database: a fake lookup.
//
// Run: node --test src/test-identifiers.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { SKU_PATTERN, generateSkuId, generateUniqueSkuId } from "./services/product/identifiers.js";

// Returns the given byte sequences in order, as crypto.randomBytes would.
const fixedRandom = (...hexValues) => {
  let i = 0;
  return () => Buffer.from(hexValues[Math.min(i++, hexValues.length - 1)], "hex");
};

// A fake Prisma client whose product table holds the given SKUs.
const fakeTx = (existing) => {
  const lookups = [];
  return {
    lookups,
    product: {
      async findUnique({ where }) {
        lookups.push(where.sku_id);
        return existing.includes(where.sku_id) ? { id: "taken" } : null;
      },
    },
  };
};

test("sku_id format is PRD- plus 8 upper-case hex characters", () => {
  assert.equal(generateSkuId(fixedRandom("7f3a09c2")), "PRD-7F3A09C2");
  for (let i = 0; i < 50; i += 1) assert.match(generateSkuId(), SKU_PATTERN);
});

test("a free sku_id is returned after one lookup", async () => {
  const tx = fakeTx([]);
  assert.equal(await generateUniqueSkuId(tx, fixedRandom("00000001")), "PRD-00000001");
  assert.deepEqual(tx.lookups, ["PRD-00000001"]);
});

test("a sku_id already in use is never reused: a new one is drawn", async () => {
  const tx = fakeTx(["PRD-00000001", "PRD-00000002"]);
  const sku = await generateUniqueSkuId(tx, fixedRandom("00000001", "00000002", "00000003"));
  assert.equal(sku, "PRD-00000003");
  assert.deepEqual(tx.lookups, ["PRD-00000001", "PRD-00000002", "PRD-00000003"]);
});

test("gives up with an error instead of looping forever", async () => {
  const tx = fakeTx(["PRD-00000001"]);
  await assert.rejects(generateUniqueSkuId(tx, fixedRandom("00000001")), /Could not generate a unique sku_id/);
  assert.equal(tx.lookups.length, 10);
});
