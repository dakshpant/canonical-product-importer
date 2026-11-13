
import prisma from "../../config/prisma.js";

import { validateUrlBatch } from "../../validators/url.validator.js";

import {
  BATCH_STATUS,
  IMPORT_STATUS,
} from "../../constants/status.js";

export async function createImportBatch(urls) {
  // 1. Validate all submitted URLs
  const validation = validateUrlBatch(urls);

  if (!validation.success) {
    return validation;
  }

  // 2. Count URLs that are already invalid or duplicates
  const failedCount = validation.results.filter(
    (item) => !item.isValid || item.isDuplicate
  ).length;

  // 3. Prepare an ImportRecord for every submitted URL
  const records = validation.results.map((item) => ({
    // Store the normalised URL (trimmed, #fragment removed) when valid,
    // so it can be matched against existing products later.
    url: String(item.normalizedUrl ?? item.originalUrl ?? ""),

    status:
      item.isValid && !item.isDuplicate
        ? IMPORT_STATUS.PENDING
        : IMPORT_STATUS.FAILED,

    error_message: item.error,
  }));

  // 4. Create the batch and all its records
  const batch = await prisma.importBatch.create({
    data: {
      status:
        failedCount === validation.total
          ? BATCH_STATUS.FAILED
          : BATCH_STATUS.PENDING,

      total_urls: validation.total,

      // These URLs have already reached a terminal state.
      completed_urls: failedCount,
      failed_urls: failedCount,

      records: {
        create: records,
      },
    },

    include: {
      records: true,
    },
  });

  // 5. Return the saved batch
  return {
    success: true,
    batch,
  };
}

// Fields the import screens need from each record (see docs/api-contract.md).
const RECORD_INCLUDE = {
  orderBy: { created_at: "asc" },
  include: {
    update_proposal: { select: { id: true, status: true } },
  },
};

/** All batches, newest first, without their records. */
export async function getImportBatches() {
  return prisma.importBatch.findMany({
    orderBy: { created_at: "desc" },
  });
}

/** One batch with its records, or null if it does not exist. */
export async function getImportBatch(batchId) {
  return prisma.importBatch.findUnique({
    where: { id: batchId },
    include: { records: RECORD_INCLUDE },
  });
}
