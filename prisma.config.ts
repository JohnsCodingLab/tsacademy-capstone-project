import "dotenv/config";
import { defineConfig } from "prisma/config";
import { env } from "./src/config/env.js";

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env.DATABASE_URL,
  },
});
