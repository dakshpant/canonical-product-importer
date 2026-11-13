// App-generated identifiers. Never scraped, never edited by the admin.
// The database also enforces uniqueness (@unique on sku_id and slug).
import { randomBytes } from "node:crypto";

// PRD- plus 8 upper-case hex characters, e.g. PRD-7F3A09C2. Random rather
// than derived from the name, so it never changes when the name is edited.
// The same format is used by the migration that backfilled older products.
export const SKU_PATTERN = /^PRD-[0-9A-F]{8}$/;
const MAX_SKU_ATTEMPTS = 10;

export function generateSkuId(random = randomBytes) {
  return `PRD-${random(4).toString("hex").toUpperCase()}`;
}

/**
 * A SKU no product has yet. `tx` is a Prisma client or transaction; with
 * ~4 billion possible values a retry is very unlikely, but it is handled.
 */
export async function generateUniqueSkuId(tx, random = randomBytes) {
  for (let attempt = 0; attempt < MAX_SKU_ATTEMPTS; attempt += 1) {
    const sku = generateSkuId(random);
    const taken = await tx.product.findUnique({ where: { sku_id: sku }, select: { id: true } });
    if (!taken) return sku;
  }
  throw new Error(`Could not generate a unique sku_id after ${MAX_SKU_ATTEMPTS} attempts.`);
}
