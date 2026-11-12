import prisma from "./config/prisma.js";

try {
  await prisma.$connect();
  console.log("Database connected successfully!");
} catch (error) {
  console.error("Database connection failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

