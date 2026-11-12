import prisma from "./config/prisma.js";

async function main() {
  const product = await prisma.product.findFirst();
  const importRecord = await prisma.importRecord.findFirst();

  if (!product || !importRecord) {
    throw new Error("Create a product and import record first.");
  }

  const source = await prisma.productSource.create({
    data: {
      productId: product.id,
      importRecordId: importRecord.id,
      fieldName: "tagline",
      extractedValue: "Simplify your cloud operations",
      evidenceText: "Our platform simplifies cloud operations.",
      sourceType: "META_DESCRIPTION",
      sourceUrl: "https://example.com/products/cloud-platform",
    },
  });

  console.log("Source created:", source);

  const recordWithSources = await prisma.importRecord.findUnique({
    where: { id: importRecord.id },
    include: { sources: true },
  });

  console.log("Sources linked to import:", recordWithSources.sources);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
