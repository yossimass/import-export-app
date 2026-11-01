import { createClerkClient, verifyToken } from "@clerk/backend";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// The users.openId column holds the Clerk user id ("user_...").

const clerk = createClerkClient({ secretKey: ENV.clerkSecretKey });

// Avoid a DB write on every request; refresh lastSignedIn at most hourly
const LAST_SIGNED_IN_REFRESH_MS = 60 * 60 * 1000;

/** Clerk session token from the Authorization header, or the __session cookie (e.g. file links). */
function getSessionToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  if (!req.headers.cookie) return undefined;
  return parseCookieHeader(req.headers.cookie).__session;
}

/** Create or link the local user row for a Clerk user on first sign-in. */
async function syncClerkUser(clerkUserId: string): Promise<User | undefined> {
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const primaryEmail = clerkUser.primaryEmailAddress;
  const email = primaryEmail?.emailAddress ?? null;
  const emailVerified = primaryEmail?.verification?.status === "verified";

  // Carry over accounts created under the previous (Manus) login by verified email
  if (email && emailVerified) {
    const existing = await db.getUserByEmail(email);
    if (existing && !existing.openId.startsWith("user_")) {
      await db.relinkUserOpenId(existing.id, clerkUserId);
    }
  }

  await db.upsertUser({
    openId: clerkUserId,
    name: clerkUser.fullName || clerkUser.username || null,
    email,
    loginMethod: clerkUser.externalAccounts[0]?.provider ?? "email",
    lastSignedIn: new Date(),
  });
  return db.getUserByOpenId(clerkUserId);
}

export async function authenticateRequest(req: Request): Promise<User> {
  const token = getSessionToken(req);
  if (!token) throw ForbiddenError("Missing session token");

  let clerkUserId: string;
  try {
    const payload = await verifyToken(token, {
      secretKey: ENV.clerkSecretKey,
      authorizedParties: ENV.clerkAuthorizedParties.length ? ENV.clerkAuthorizedParties : undefined,
    });
    clerkUserId = payload.sub;
  } catch (error) {
    throw ForbiddenError("Invalid session token");
  }

  let user = await db.getUserByOpenId(clerkUserId);
  if (!user) {
    try {
      user = await syncClerkUser(clerkUserId);
    } catch (error) {
      console.error("[Auth] Failed to sync user from Clerk:", error);
      throw ForbiddenError("Failed to sync user info");
    }
  }
  if (!user) throw ForbiddenError("User not found");

  if (Date.now() - new Date(user.lastSignedIn).getTime() > LAST_SIGNED_IN_REFRESH_MS) {
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  }

  return user;
}
