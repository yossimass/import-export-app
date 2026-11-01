export const ENV = {
  // Netlify DB (Neon) sets NETLIFY_DATABASE_URL; DATABASE_URL overrides it (e.g. for a production Postgres)
  databaseUrl: process.env.DATABASE_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  // Origins allowed to present Clerk tokens, e.g. "https://app.example.com" (comma-separated)
  clerkAuthorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES ?? "")
    .split(",").map(s => s.trim()).filter(Boolean),
  // Clerk user id that is always granted the admin role
  ownerOpenId: process.env.OWNER_CLERK_USER_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Any OpenAI-compatible chat completions endpoint. Falls back to the Manus forge proxy.
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "gemini-2.5-flash",
};
