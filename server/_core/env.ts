export const ENV = {
  // Netlify Database sets NETLIFY_DB_URL automatically; DATABASE_URL overrides it
  // (e.g. when moving to a production Postgres)
  databaseUrl: process.env.DATABASE_URL ?? process.env.NETLIFY_DB_URL ?? process.env.NETLIFY_DATABASE_URL ?? "",
  // Workspace granted the admin role: "anon_" + the itcp_workspace cookie value
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Optional Google sign-in. Without these, everyone uses anonymous workspaces.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  // Signs the session cookie; falls back to a key derived from the Google secret
  sessionSecret: process.env.SESSION_SECRET ?? "",
  // Google account email granted the admin role
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  // Optional server-side AI (any OpenAI-compatible API). Without LLM_API_KEY the
  // app runs on official data and rules only; testers can still use local Ollama.
  llmApiUrl: process.env.LLM_API_URL ?? "https://openrouter.ai/api/v1",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "google/gemini-2.5-flash",
  // Requests per workspace per day to the server-side AI
  aiDailyLimit: Number(process.env.AI_DAILY_LIMIT ?? 100),
};
