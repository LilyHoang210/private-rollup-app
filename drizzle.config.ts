import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://private_rollup:private_rollup_dev_password@127.0.0.1:5432/private_rollup",
  },
  strict: true,
  verbose: true,
});
