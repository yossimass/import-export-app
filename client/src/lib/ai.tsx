import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { createChat } from "@shared/ai/chat";
import type { EnhanceDeps } from "@shared/ai/enhance";
import { getAgreementById } from "@shared/tradeAgreements";

// ── Settings ────────────────────────────────────────────────────────────────

export type AiMode = "off" | "server" | "local";
export type AiSettings = {
  mode: AiMode | null; // null = default (site AI when available)
  localUrl: string;
  localModel: string;
};

const STORAGE_KEY = "itcp.ai";
const DEFAULTS: AiSettings = { mode: null, localUrl: "http://localhost:11434/v1", localModel: "gemma3:4b" };

function loadSettings(): AiSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

// ── Requests ────────────────────────────────────────────────────────────────

export type EnhanceRequest =
  | { feature: "hts"; query: string; candidates: any[] }
  | { feature: "tariff"; input: any; base: any }
  | { feature: "regulations"; country: string; htsCode?: string; productDescription?: string; base: any[] }
  | { feature: "checklist"; shipmentType: string; originCountry: string; destinationCountry: string; htsCode?: string; base: any[] }
  | { feature: "po"; base: any; text?: string; fileUrl?: string; imageDataUrl?: string }
  | { feature: "origin"; tradeAgreement: string; exporterCountry?: string; destinationCountry?: string; goodsDescription?: string; htsCode?: string; base: any }
  | { feature: "assistant"; question: string; history?: Array<{ role: "user" | "assistant"; content: string }>; context?: string };

type AiContextValue = {
  settings: AiSettings;
  setSettings: (s: AiSettings) => void;
  /** Effective provider right now */
  mode: AiMode;
  serverAvailable: boolean;
  serverModel: string | null;
  label: string;
  run: (req: EnhanceRequest) => Promise<any>;
  testLocal: (s?: AiSettings) => Promise<string>;
};

const AiContext = createContext<AiContextValue | null>(null);

export function AiProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AiSettings>(loadSettings);
  const { data: status } = trpc.ai.status.useQuery(undefined, { staleTime: Infinity });
  const utils = trpc.useUtils();
  const serverAvailable = Boolean(status?.server.available);

  const setSettings = useCallback((s: AiSettings) => {
    setSettingsState(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      // storage unavailable: setting lasts for this visit
    }
  }, []);

  const mode: AiMode = settings.mode ?? (serverAvailable ? "server" : "off");

  const localDeps = useCallback((s: AiSettings): EnhanceDeps => ({
    chat: createChat({ baseUrl: s.localUrl, model: s.localModel, timeoutMs: 90000 }),
    lookupCodes: codes => utils.client.ai.lookupCodes.query({ codes }),
  }), [utils]);

  const run = useCallback(async (req: EnhanceRequest): Promise<any> => {
    if (mode === "off") throw new Error("AI is off");
    if (mode === "server") {
      if (!serverAvailable) throw new Error("Site AI is not configured");
      const { imageDataUrl: _ignored, ...rest } = req as any;
      return utils.client.ai.enhance.mutate(rest);
    }
    const deps = localDeps(settings);
    // Loaded on first local use only (zod + prompts stay out of the main bundle)
    const enhance = await import("@shared/ai/enhance");
    switch (req.feature) {
      case "hts": return { hts: await enhance.enhanceHts(deps, req) };
      case "tariff": return { tariff: await enhance.enhanceTariff(deps, req) };
      case "regulations": return { regulations: await enhance.enhanceRegulations(deps, req) };
      case "checklist": return { checklist: await enhance.enhanceChecklist(deps, req) };
      case "po": return { po: await enhance.enhancePO(deps, req) };
      case "origin": {
        const agreement = getAgreementById(req.tradeAgreement);
        return {
          origin: await enhance.enhanceOrigin(deps, {
            ...req,
            agreementName: agreement?.name ?? req.tradeAgreement,
            criteria: agreement?.originCriteria ?? [],
          }),
        };
      }
      case "assistant": return { answer: await enhance.askAssistant(deps, req) };
    }
  }, [mode, serverAvailable, settings, localDeps, utils]);

  const testLocal = useCallback(async (s: AiSettings = settings) => {
    const chat = createChat({ baseUrl: s.localUrl, model: s.localModel, timeoutMs: 60000 });
    return chat([{ role: "user", content: "Reply with the single word: ready" }], { maxTokens: 10 });
  }, [settings]);

  const label = mode === "server"
    ? `Site AI${status?.server.model ? ` · ${status.server.model.split("/").pop()}` : ""}`
    : mode === "local" ? `Local · ${settings.localModel}` : "AI off";

  const value = useMemo<AiContextValue>(() => ({
    settings, setSettings, mode, serverAvailable, serverModel: status?.server.model ?? null, label, run, testLocal,
  }), [settings, setSettings, mode, serverAvailable, status, label, run, testLocal]);

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside AiProvider");
  return ctx;
}

// ── Progressive enhancement hook ────────────────────────────────────────────

export type EnhanceState = "off" | "working" | "done" | "failed";

/**
 * Show `base` immediately; when AI is on, improve it in the background and
 * return the improved version once it arrives. On any failure the base stays.
 */
export function useEnhanced<T>(base: T | null | undefined, request: EnhanceRequest | null, pick: (result: any) => T) {
  const { mode, run } = useAi();
  const enabled = Boolean(base && request && mode !== "off");
  const query = useQuery({
    queryKey: ["ai-enhance", mode, request],
    queryFn: async () => pick(await run(request!)),
    enabled,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [errorShown, setErrorShown] = useState<string | null>(null);
  useEffect(() => {
    if (query.error) setErrorShown((query.error as Error).message);
  }, [query.error]);

  const state: EnhanceState = !enabled ? "off" : query.isFetching ? "working" : query.data ? "done" : query.isError ? "failed" : "working";
  return {
    data: (state === "done" ? query.data : base) as T | null | undefined,
    state,
    error: state === "failed" ? errorShown : null,
  };
}

/** Read a File as a data: URL (for local vision models). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
