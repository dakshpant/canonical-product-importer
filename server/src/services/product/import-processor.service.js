import prisma from "../../config/prisma.js";

import { BATCH_STATUS, IMPORT_STATUS } from "../../constants/status.js";
import { prepareExtractionInput } from "../scraper/product-extraction-input.service.js";

const TERMINAL_RECORD_STATUSES = [
  IMPORT_STATUS.SUCCESS,
  IMPORT_STATUS.PARTIAL,
  IMPORT_STATUS.FAILED,
];

// "CODE: message", so the UI can show the reason and group by the code.
function formatError(error) {
  const code = error?.code || "INTERNAL_ERROR";
  const message = error?.message || "Unknown error.";
  return `${code}: ${message}`;
}

/**
 * Recompute a batch's progress counters from its records, so the counts
 * are always consistent with record statuses (no drift from increments).
 */
export async function refreshBatchProgress(batchId, { finished = false } = {}) {
  const counts = await prisma.importRecord.groupBy({
    by: ["status"],
    where: { batch_id: batchId },
    _count: { _all: true },
  });

  const countOf = (status) =>
    counts.find((row) => row.status === status)?._count._all ?? 0;

  const total = counts.reduce((sum, row) => sum + row._count._all, 0);
  const completed = TERMINAL_RECORD_STATUSES.reduce(
    (sum, status) => sum + countOf(status),
    0,
  );
  const failed = countOf(IMPORT_STATUS.FAILED);

  let status = BATCH_STATUS.PROCESSING;

  if (finished || completed === total) {
    if (failed === total) status = BATCH_STATUS.FAILED;
    else if (failed > 0) status = BATCH_STATUS.PARTIAL;
    else status = BATCH_STATUS.COMPLETED;
  }

  return prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status,
      completed_urls: completed,
      failed_urls: failed,
    },
  });
}

/**
 * Run one PENDING record through the pipeline:
 * robots.txt -> fetch -> extract -> content check -> extractProduct (LLM).
 *
 * extractProduct(input, record) is the AI step. It must return
 * { status: SUCCESS | PARTIAL, data } where data is saved as extracted_data.
 *
 * Never throws for a per-URL failure: the record is marked FAILED instead,
 * so one bad URL can't stop the rest of the batch.
 */
export async function processImportRecord(recordId, { extractProduct }) {
  if (typeof extractProduct !== "function") {
    throw new TypeError("processImportRecord needs an extractProduct function.");
  }

  // Claim the record only if it is still PENDING, so it is never
  // processed twice.
  const claimed = await prisma.importRecord.updateMany({
    where: { id: recordId, status: IMPORT_STATUS.PENDING },
    data: {
      status: IMPORT_STATUS.PROCESSING,
      attempts: { increment: 1 },
      error_message: null,
    },
  });

  if (claimed.count === 0) return null;

  const record = await prisma.importRecord.findUnique({ where: { id: recordId } });

  try {
    const input = await prepareExtractionInput(record.url);
    const result = await extractProduct(input, record);

    const status =
      result?.status === IMPORT_STATUS.PARTIAL
        ? IMPORT_STATUS.PARTIAL
        : IMPORT_STATUS.SUCCESS;

    return await prisma.importRecord.update({
      where: { id: recordId },
      data: {
        status,
        extracted_data: result?.data ?? null,
      },
    });
  } catch (error) {
    if (!error?.code) {
      console.error(`Unexpected error while importing ${record.url}:`, error);
    }

    return prisma.importRecord.update({
      where: { id: recordId },
      data: {
        status: IMPORT_STATUS.FAILED,
        error_message: formatError(error),
      },
    });
  }
}

/**
 * Process every PENDING record in a batch, one at a time
 * (see docs/design-decisions.md: sequential processing).
 * Batch counters are refreshed after each URL so the UI can show progress.
 */
export async function processImportBatch(batchId, { extractProduct }) {
  const pending = await prisma.importRecord.findMany({
    where: { batch_id: batchId, status: IMPORT_STATUS.PENDING },
    orderBy: { created_at: "asc" },
    select: { id: true },
  });

  if (pending.length === 0) {
    return refreshBatchProgress(batchId, { finished: true });
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: BATCH_STATUS.PROCESSING },
  });

  for (const { id } of pending) {
    await processImportRecord(id, { extractProduct });
    await refreshBatchProgress(batchId);
  }

  return refreshBatchProgress(batchId, { finished: true });
}
