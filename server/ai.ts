/**
 * Server-side AI: provider from env, daily per-workspace limit and a response
 * cache in Netlify Blobs. The feature logic lives in shared/ai/enhance.ts so
 * the browser can run the same code against a local Ollama.
 */
import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { createChat, type ChatFn } from "../shared/ai/chat";
import type { EnhanceDeps } from "../shared/ai/enhance";
import type { OfficialLine } from "../shared/tradeTypes";
import { ENV } from "./_core/env";
import { lookupHts } from "./tradeData";

const CACHE_TTL_MS = 7 * 86400 * 1000;

export function serverAiStatus() {
  return { available: Boolean(ENV.llmApiKey), model: ENV.llmApiKey ? ENV.llmModel : null };
}

function serverChat(): ChatFn | null {
  if (!ENV.llmApiKey) return null;
  return createChat({
    baseUrl: ENV.llmApiUrl,
    apiKey: ENV.llmApiKey,
    model: ENV.llmModel,
    // Stay under Netlify's synchronous function limit
    timeoutMs: 20000,
    headers: { "X-Title": "iTCP" },
  });
}

/** Official schedule lookups for validating AI-suggested codes. */
export async function lookupCodes(codes: string[]): Promise<Record<string, OfficialLine | null>> {
  const unique = Array.from(new Set(codes)).slice(0, 20);
  const entries = await Promise.all(unique.map(async code => {
    const line = /\d{4}/.test(code) ? await lookupHts(code, 3000).catch(() => null) : null;
    return [code, line && line.general ? { code: line.code, description: line.description, general: line.general, special: line.special, other: line.other } : null] as const;
  }));
  return Object.fromEntries(entries);
}

function blobStore(name: string) {
  try {
    return getStore(name);
  } catch {
    return null; // no Blobs context (plain local Node): skip limits/cache
  }
}

/** Count a request against the workspace's daily allowance. */
async function consumeQuota(userId: number) {
  const store = blobStore("ai-usage");
  if (!store) return;
  const key = `${userId}/${new Date().toISOString().slice(0, 10)}`;
  const used = Number((await store.get(key).catch(() => null)) ?? 0);
  if (used >= ENV.aiDailyLimit) throw new Error("Daily AI limit reached for this workspace");
  await store.set(key, String(used + 1)).catch(() => {});
}

export class AiUnavailableError extends Error {}

/**
 * Run an enhancement with the server provider. Identical requests are served
 * from cache (when `cacheable`) and don't count against the limit.
 */
export async function runServerAi<T>(
  userId: number,
  cacheKeyData: unknown,
  cacheable: boolean,
  run: (deps: EnhanceDeps) => Promise<T>
): Promise<T> {
  const chat = serverChat();
  if (!chat) throw new AiUnavailableError("Server AI is not configured");

  const store = cacheable ? blobStore("ai-cache") : null;
  const key = createHash("sha256").update(ENV.llmModel + JSON.stringify(cacheKeyData)).digest("hex");
  if (store) {
    const hit = await store.getWithMetadata(key, { type: "json" }).catch(() => null);
    if (hit && Number(hit.metadata?.expires) > Date.now()) return hit.data as T;
  }

  await consumeQuota(userId);
  const result = await run({ chat, lookupCodes });
  if (store) {
    await store.setJSON(key, result, { metadata: { expires: Date.now() + CACHE_TTL_MS } }).catch(() => {});
  }
  return result;
}
