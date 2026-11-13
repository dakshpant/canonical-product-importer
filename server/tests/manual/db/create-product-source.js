import prisma from "../../../src/config/prisma.js";

async function main() {
  const product = await prisma.product.findFirst();
  const importRecord = await prisma.importRecord.findFirst();

  if (!product || !importRecord) {
    throw new Error("Create a product and import record first.");
  }

  const source = await prisma.productSource.create({
    data: {
      product_id: product.id,
      import_record_id: importRecord.id,
      field_name: "tagline",
      extracted_value: "Simplify your cloud operations",
      evidence_text: "Our platform simplifies cloud operations.",
      source_type: "META_DESCRIPTION",
      source_url: "https://example.com/products/cloud-platform",
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
