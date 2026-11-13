
import { randomUUID } from "node:crypto";
import prisma from "../../../src/config/prisma.js";
import { persistExtractedProduct } from "../../../src/services/product/product.service.js";

const unique = randomUUID().slice(0, 8);
const url = `https://example.com/test-product-${unique}`;

let batchId;
let productId;
const recordIds = [];

const makeExtraction = (description) => ({
  product: {
    name: `Test Product ${unique}`,
    category: "Developer platform",
    short_description: description,
    website: url,
  },
  sources: [
    {
      field_name: "name",
      extracted_value: `Test Product ${unique}`,
      evidence_text: `Test Product ${unique}`,
      source_type: "metadata",
      source_url: url,
    },
    {
      field_name: "category",
      extracted_value: "Developer platform",
      evidence_text: "Developer platform",
      source_type: "page_text",
      source_url: url,
    },
    {
      field_name: "short_description",
      extracted_value: description,
      evidence_text: description,
      source_type: "page_text",
      source_url: url,
    },
  ],
});

async function makeRecord() {
  return prisma.importRecord.create({
    data: {
      url,
      status: "SUCCESS",
      batch_id: batchId,
    },
  });
}

try {
  const batch = await prisma.importBatch.create({
    data: { total_urls: 2 },
  });
  batchId = batch.id;

  // Test 1: New product
  const firstRecord = await makeRecord();
  recordIds.push(firstRecord.id);

  const firstResult = await persistExtractedProduct(
    firstRecord,
    makeExtraction("Original description"),
  );

  productId = firstResult.productId;
  console.log("New product result:", firstResult);

  // Test 2: Existing product refresh
  const secondRecord = await makeRecord();
  recordIds.push(secondRecord.id);

  const secondResult = await persistExtractedProduct(
    secondRecord,
    makeExtraction("Updated description"),
  );

  console.log("Refresh result:", secondResult);

  const savedProduct = await prisma.product.findUnique({
    where: { id: productId },
  });

  console.log("Saved description:", savedProduct.short_description);

  const proposal = await prisma.productUpdateProposal.findUnique({
    where: { import_record_id: secondRecord.id },
  });

  console.log("Proposed description:", proposal.proposed_data.short_description);

} catch (error) {
  console.error("Persistence test failed:", error);
} finally {
  if (recordIds.length) {
    await prisma.productSource.deleteMany({
      where: { import_record_id: { in: recordIds } },
    });

    await prisma.productUpdateProposal.deleteMany({
      where: { import_record_id: { in: recordIds } },
    });

    await prisma.importRecord.deleteMany({
      where: { id: { in: recordIds } },
    });
  }

  if (productId) {
    await prisma.product.deleteMany({
      where: { id: productId },
    });
  }

  if (batchId) {
    await prisma.importBatch.deleteMany({
      where: { id: batchId },
    });
  }

  await prisma.$disconnect();
}
