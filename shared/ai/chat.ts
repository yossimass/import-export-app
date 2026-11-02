/**
 * Minimal OpenAI-compatible chat client shared by the server (any hosted
 * provider, e.g. OpenRouter) and the browser (a local Ollama at
 * http://localhost:11434/v1). No SDK so it runs in both environments.
 */

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type ChatOptions = {
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
};

/** Sends messages and returns the assistant's text. Throws on any failure. */
export type ChatFn = (messages: ChatMessage[], options?: ChatOptions) => Promise<string>;

export type ProviderConfig = {
  baseUrl: string; // e.g. https://openrouter.ai/api/v1 or http://localhost:11434/v1
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export function createChat(config: ProviderConfig): ChatFn {
  const url = config.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  return async (messages, options = {}) => {
    const timeout = AbortSignal.timeout(config.timeoutMs ?? 20000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        ...config.headers,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        max_tokens: options.maxTokens ?? 1500,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`AI provider returned ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("AI provider returned an empty answer");
    return content;
  };
}

/** Parse a JSON object out of a model reply (tolerates code fences and chatter). */
export function parseJsonReply(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI reply did not contain JSON");
  return JSON.parse(body.slice(start, end + 1));
}
