import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getOrCreateWorkspaceUser } from "./auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = (await getOrCreateWorkspaceUser(opts.req, opts.res)) ?? null;
  } catch (error) {
    // e.g. database unavailable; public procedures still work
    console.error("[Auth] Workspace lookup failed", error);
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
