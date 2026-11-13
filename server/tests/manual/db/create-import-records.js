import prisma from "../../../src/config/prisma.js";

try {
  // Create one batch containing two URL records
  const batch = await prisma.importBatch.create({
    data: {
      total_urls: 2,
      completed_urls: 1,
      failed_urls: 1,
      status: "PARTIAL",

      records: {
        create: [
          {
            url: "https://example.com/product-a",
            status: "SUCCESS",
            extracted_data: {
              name: "Product A",
              website: "https://example.com",
            },
          },
          {
            url: "https://example.com/product-b",
            status: "FAILED",
            error_message: "Unable to extract product information",
          },
        ],
      },
    },
    include: {
      records: true,
    },
  });

  console.log("Created import batch:", batch);
  console.log("Individual URL records:", batch.records);

  // Retrieve the batch again
  const savedBatch = await prisma.importBatch.findUnique({
    where: {
      id: batch.id,
    },
    include: {
      records: true,
    },
  });

  console.log("Retrieved batch:", savedBatch);
} catch (error) {
  console.error("Import test failed:", error);
} finally {
  await prisma.$disconnect();
}
