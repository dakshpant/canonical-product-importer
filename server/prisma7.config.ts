import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    // Fallback keeps `npm install` (postinstall -> prisma generate) working
    // on a clean clone before .env has been created.
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
});
