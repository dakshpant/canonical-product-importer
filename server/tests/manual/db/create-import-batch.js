import prisma from "./config/prisma.js";
import { createImportBatch } from "./services/product/import.service.js";

async function main() {
  const urls = [
    "https://example.com",
    "https://google.com",
    "not-a-url",
    "https://example.com#overview",
    "https://example.com#features",
    "ftp://example.com",
  ];

  const result = await createImportBatch(urls);

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
