
import prisma from "./config/prisma.js";
import { createImportBatch } from "./services/product/import.service.js";
import { processImportBatch } from "./services/product/import-processor.service.js";
import { extractProduct } from "./services/ai/extraction.service.js";

const urls = process.argv.slice(2);

try {
  if (urls.length === 0) {
    throw new Error(
      "Usage: node src/run-import-batch.js <product-url> [product-url ...]",
    );
  }

  console.log(`Creating import batch for ${urls.length} URL(s)...`);

  const creation = await createImportBatch(urls);

  if (!creation.success) {
    console.error("URL validation failed:", creation);
    process.exitCode = 1;
  } else {
    const batch = creation.batch;

    console.log(`Batch created: ${batch.id}`);

    const result = await processImportBatch(batch.id, {
      extractProduct,
    });

    console.log("\n--- Import summary ---");
    console.log({
      batchId: result.id,
      status: result.status,
      totalUrls: result.total_urls,
      completedUrls: result.completed_urls,
      failedUrls: result.failed_urls,
    });

    const records = await prisma.importRecord.findMany({
      where: { batch_id: batch.id },
      select: {
        url: true,
        status: true,
        error_message: true,
        product_id: true,
      },
    });

    console.table(records);
  }
} catch (error) {
  console.error("Batch import failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
