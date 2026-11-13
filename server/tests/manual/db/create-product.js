import prisma from "./config/prisma.js";

try {
  const product = await prisma.product.create({
    data: {
      name: "Test Cloud Platform",
      slug: "test-cloud-platform",
      category: "Cloud Computing",
      status: "DRAFT",
      tags: ["Cloud", "SaaS"],
    },
  });

  console.log("Product created:", product);

  const savedProduct = await prisma.product.findUnique({
    where: {
      id: product.id,
    },
  });

  console.log("Product retrieved:", savedProduct);
} catch (error) {
  console.error("Product test failed:", error);
} finally {
  await prisma.$disconnect();
}