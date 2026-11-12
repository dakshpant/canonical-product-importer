import { z } from "zod";

export const urlSchema = z
  .string()
  .trim()
  .pipe(z.url({ error: "Please provide a valid URL." }))
  .refine((value) => {
    try {
      const parsedUrl = new URL(value);

      return ["http:", "https:"].includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }, "Only HTTP and HTTPS URLs are allowed.");

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

    // Invalid URL
    if (!parsed.success) {
      return {
        index,
        originalUrl: input,
        isValid: false,
        isDuplicate: false,
        error: parsed.error.issues[0].message,
      };
    }

    // Normalize URL
    const normalizedUrl = new URL(parsed.data);
    normalizedUrl.hash = "";

    const finalUrl = normalizedUrl.toString();

    // Check duplicate
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
