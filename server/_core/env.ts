export const ENV = {
  // Netlify Database sets NETLIFY_DB_URL automatically; DATABASE_URL overrides it
  // (e.g. when moving to a production Postgres)
  databaseUrl: process.env.DATABASE_URL ?? process.env.NETLIFY_DB_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  // Workspace granted the admin role: "anon_" + the itcp_workspace cookie value
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
