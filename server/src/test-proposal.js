import prisma from "./config/prisma.js";

try {
  // 1. Create an existing product
  const product = await prisma.product.create({
    data: {
      name: "Existing Cloud Platform",
      slug: `existing-cloud-${Date.now()}`,
      shortDescription: "Original description",
      status: "ACTIVE",
    },
  });

  // 2. Create an import batch
  const batch = await prisma.importBatch.create({
    data: {
      totalUrls: 1,
    },
  });

  // 3. Create an import record for the existing product
  const importRecord = await prisma.importRecord.create({
    data: {
      url: "https://example.com/cloud-platform",
      status: "SUCCESS",
      batchId: batch.id,
      productId: product.id,
      extractedData: {
        name: "Existing Cloud Platform",
        shortDescription: "Updated description",
      },
    },
  });

  // 4. Save the newly extracted information as a proposal
  const proposal = await prisma.productUpdateProposal.create({
    data: {
      productId: product.id,
      importRecordId: importRecord.id,
      proposedData: {
        shortDescription: "Updated description",
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

  console.log("Original description:", savedProduct.shortDescription);

  console.log("Proposed description:", proposal.proposedData.shortDescription);
} catch (error) {
  console.error("Proposal test failed:", error);
} finally {
  await prisma.$disconnect();
}
