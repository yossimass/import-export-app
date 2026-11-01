import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only needed for migrate/push; `generate` works offline
  dbCredentials: { url: connectionString ?? "" },
});
