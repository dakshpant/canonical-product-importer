// Pure rules for applying a refresh proposal to a product (no database here,
// so they can be unit-tested). The guarantees:
// - a field is changed only when the admin chose "proposed" for it;
// - a blank proposed value never replaces anything;
// - app-owned and admin-only fields can never be set this way.
import { PRODUCT_EXTRACTION_FIELDS } from "../../validators/product-extraction.validator.js";

// Fields owned by the application or the admin, never set from a scrape.
export const APP_OWNED_FIELDS = new Set([
  "sku_id",
  "slug",
  "unit_of_measure",
  "min_quantity",
  "max_quantity",
  "status",
]);

// Fields a refresh proposal may change.
export const PROPOSABLE_FIELDS = new Set(
  PRODUCT_EXTRACTION_FIELDS.filter((field) => !APP_OWNED_FIELDS.has(field)),
);

export const DECISION = {
  CURRENT: "current",
  PROPOSED: "proposed",
};

export function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Turn the admin's per-field decisions into the product update.
 *
 * decisions: { [field]: "current" | "proposed" }
 * Returns { updates, applied }: updates is the Prisma data object, applied the
 * list of fields that will change. Throws a 400 error for invalid decisions.
 */
export function buildProposalUpdate(proposedData, decisions) {
  if (!isPlainObject(decisions)) {
    throw badRequest("decisions must be an object of { field: \"current\" | \"proposed\" }.");
  }

  const proposed = isPlainObject(proposedData) ? proposedData : {};
  const updates = {};
  const applied = [];

  for (const [field, decision] of Object.entries(decisions)) {
    if (APP_OWNED_FIELDS.has(field)) {
      throw badRequest(`${field} cannot be changed by a refresh.`);
    }
    if (!PROPOSABLE_FIELDS.has(field)) {
      throw badRequest(`Unknown field: ${field}.`);
    }
    if (decision !== DECISION.CURRENT && decision !== DECISION.PROPOSED) {
      throw badRequest(`Decision for ${field} must be "current" or "proposed".`);
    }

    // Keep the current value unless the admin chose a real new one.
    if (decision === DECISION.PROPOSED && hasValue(proposed[field])) {
      updates[field] = proposed[field];
      applied.push(field);
    }
  }

  return { updates, applied };
}
