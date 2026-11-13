import { z } from "zod";

export const urlSchema = z
  .string()
  .trim()
  .pipe(z.url({ error: "Please provide a valid URL." }))
  .refine(
    (value) => /^https?:\/\/\S+$/i.test(value) && !/[\[\]()<>]/.test(value),
    "Please provide a plain HTTP or HTTPS URL, not a Markdown link.",
  )
  .refine((value) => {
    try {
      const parsedUrl = new URL(value);
      return ["http:", "https:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }, "Only HTTP and HTTPS URLs are allowed.");

  
// console.log(
//   "Markdown rejection test:",
//   urlSchema.safeParse(
//     "[https://www.hubspot.com/products/crm](https://www.hubspot.com/products/crm)",
//   ).success,
// );

export function validateUrlBatch(urls) {
  if (!Array.isArray(urls)) {
    return {
      success: false,
      error: "URLs must be provided as an array.",
    };
  }

  const seen = new Map();

  const results = urls.map((input, index) => {
    const parsed = urlSchema.safeParse(input);

    if (!parsed.success) {
      return {
        index,
        originalUrl: input,
        isValid: false,
        isDuplicate: false,
        error: parsed.error.issues[0].message,
      };
    }

    const normalizedUrl = new URL(parsed.data);
    normalizedUrl.hash = "";

    const finalUrl = normalizedUrl.toString();

    if (seen.has(finalUrl)) {
      return {
        index,
        originalUrl: input,
        normalizedUrl: finalUrl,
        isValid: true,
        isDuplicate: true,
        duplicateOf: seen.get(finalUrl),
        error: "Duplicate URL in this batch.",
      };
    }

    seen.set(finalUrl, index);

    return {
      index,
      originalUrl: input,
      normalizedUrl: finalUrl,
      isValid: true,
      isDuplicate: false,
      error: null,
    };
  });

  return {
    success: true,
    total: results.length,
    validCount: results.filter((item) => item.isValid && !item.isDuplicate)
      .length,
    invalidCount: results.filter((item) => !item.isValid).length,
    duplicateCount: results.filter((item) => item.isDuplicate).length,
    results,
  };
}
