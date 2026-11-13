import prisma from "../../../src/config/prisma.js";

try {
  // 1. Create an existing product
  const product = await prisma.product.create({
    data: {
      name: "Existing Cloud Platform",
      slug: `existing-cloud-${Date.now()}`,
      short_description: "Original description",
      status: "ACTIVE",
    },
  });

  // 2. Create an import batch
  const batch = await prisma.importBatch.create({
    data: {
      total_urls: 1,
    },
  });

  // 3. Create an import record for the existing product
  const importRecord = await prisma.importRecord.create({
    data: {
      url: "https://example.com/cloud-platform",
      status: "SUCCESS",
      batch_id: batch.id,
      product_id: product.id,
      extracted_data: {
        name: "Existing Cloud Platform",
        short_description: "Updated description",
      },
    },
  });

  // 4. Save the newly extracted information as a proposal
  const proposal = await prisma.productUpdateProposal.create({
    data: {
      product_id: product.id,
      import_record_id: importRecord.id,
      proposed_data: {
        short_description: "Updated description",
      },
    },
  });

  console.log("Proposal created:", proposal);

  // 5. Retrieve the original product
  const savedProduct = await prisma.product.findUnique({
    where: {
      id: product.id,
    },
  });

  console.log("Original description:", savedProduct.short_description);

  console.log("Proposed description:", proposal.proposed_data.short_description);
} catch (error) {
  console.error("Proposal test failed:", error);
} finally {
  await prisma.$disconnect();
}
