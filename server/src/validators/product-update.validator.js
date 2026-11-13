import { z } from "zod";

// Admin edits (PATCH /api/products/:id). Only the fields sent are changed.
// - Blank text is stored as null (the admin cleared the field).
// - sku_id, slug, status and unknown keys are refused (.strict()).
// - min_quantity <= max_quantity is checked here when both are sent, and in
//   the service against the stored value when only one is sent.

// "" or whitespace -> null; otherwise the trimmed text.
const nullableString = z
  .string({ error: "Must be text." })
  .trim()
  .nullable()
  .transform((value) => (value === "" ? null : value));

const nullableUrl = nullableString.refine(
  (value) => {
    if (value === null) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  },
  { message: "Must be a full http(s) URL." },
);

const nullableNumber = z
  .number({ error: "Must be a number." }) // zod 4 rejects Infinity/NaN by default
  .nonnegative({ error: "Must be 0 or more." })
  .nullable();

// List of non-empty text items; blanks and duplicates dropped; null -> [].
const stringList = z
  .array(z.string({ error: "List items must be text." }).trim())
  .nullable()
  .transform((items) => [...new Set((items ?? []).filter(Boolean))]);

export const productUpdateSchema = z
  .object({
    name: z
      .string({ error: "Name is required." })
      .trim()
      .min(1, { error: "Name is required." })
      .optional(),
    product_kind: nullableString.optional(),

    category: nullableString.optional(),
    industry: nullableString.optional(),
    sub_category: nullableString.optional(),

    tagline: nullableString.optional(),
    short_description: nullableString.optional(),
    overview: nullableString.optional(),

    website: nullableUrl.optional(),
    unit_of_measure: nullableString.optional(),
    min_quantity: nullableNumber.optional(),
    max_quantity: nullableNumber.optional(),

    image_url: nullableUrl.optional(),
    image_alt: nullableString.optional(),
    image_type: nullableString.optional(),
    image_source_page: nullableUrl.optional(),

    tags: stringList.optional(),
    skills: stringList.optional(),
    features: stringList.optional(),
    deployments: stringList.optional(),
    platforms: stringList.optional(),
    target_customers: stringList.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  })
  .refine(
    (data) =>
      data.min_quantity == null ||
      data.max_quantity == null ||
      data.min_quantity <= data.max_quantity,
    { message: "min_quantity cannot be greater than max_quantity." },
  );

/** First validation issue as "field: message" for the API response. */
export function formatUpdateError(error) {
  const issue = error.issues[0];
  if (issue.code === "unrecognized_keys") {
    return `These fields cannot be edited: ${issue.keys.join(", ")}.`;
  }
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
