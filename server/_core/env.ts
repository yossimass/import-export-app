export const ENV = {
  // Netlify DB (Neon) sets NETLIFY_DATABASE_URL; DATABASE_URL overrides it (e.g. for a production Postgres)
  databaseUrl: process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  // Workspace granted the admin role: "anon_" + the itcp_workspace cookie value
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Any OpenAI-compatible chat completions endpoint. Falls back to the Manus forge proxy.
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gemini-2.5-flash",
};
