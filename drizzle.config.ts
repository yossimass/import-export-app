import { defineConfig } from "drizzle-kit";

// Netlify applies the SQL files in netlify/database/migrations on every deploy.
// After changing drizzle/schema.ts: run `pnpm db:generate`, then copy the new
// file from drizzle/ into netlify/database/migrations/ with a timestamp prefix.
const connectionString = process.env.DATABASE_URL ?? process.env.NETLIFY_DB_URL;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Only needed for migrate/push against a non-Netlify database
  dbCredentials: { url: connectionString ?? "" },
});
