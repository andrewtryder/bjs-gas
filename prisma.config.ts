import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Allow `prisma generate` to run in CI/build environments without DATABASE_URL.
    url: process.env.DATABASE_URL ?? "",
  },
});
