import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Two ways in:
//  - Anonymous workspace (default): each browser gets a random, unguessable
//    itcp_workspace cookie; users.openId stores "anon_<id>".
//  - Google sign-in (optional): a signed itcp_session cookie holds the user id;
//    users.openId stores "google_<sub>". See googleAuth.ts.
const COOKIE_NAME = "itcp_workspace";
const SESSION_COOKIE = "itcp_session";
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

// Avoid a DB write on every request; refresh lastSignedIn at most hourly
const LAST_SIGNED_IN_REFRESH_MS = 60 * 60 * 1000;

export function cookieOptions(req: Request, maxAge: number): CookieOptions {
  return { httpOnly: true, sameSite: "lax", secure: req.secure, path: "/", maxAge };
}

function readCookie(req: Request, name: string): string | undefined {
  if (!req.headers.cookie) return undefined;
  return parseCookieHeader(req.headers.cookie)[name];
}

export function readWorkspaceId(req: Request): string | undefined {
  const id = readCookie(req, COOKIE_NAME);
  return id && ID_PATTERN.test(id) ? id : undefined;
}

// ---------------------------------------------------------------------------
// Signed session cookie: "<userId>.<expiresAt>.<hmac>"
// ---------------------------------------------------------------------------

function sessionKey(): string {
  if (ENV.sessionSecret) return ENV.sessionSecret;
  if (ENV.googleClientSecret) return createHash("sha256").update(`itcp-session:${ENV.googleClientSecret}`).digest("hex");
  return "";
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function setSession(req: Request, res: Response, userId: number) {
  const key = sessionKey();
  if (!key) throw new Error("Session secret not configured");
  const payload = `${userId}.${Date.now() + SESSION_MAX_AGE_MS}`;
  res.cookie(SESSION_COOKIE, `${payload}.${sign(payload, key)}`, cookieOptions(req, SESSION_MAX_AGE_MS));
}

export function clearSession(req: Request, res: Response) {
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(req, 0), maxAge: undefined });
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(req, 0), maxAge: undefined });
}

function readSessionUserId(req: Request): number | undefined {
  const raw = readCookie(req, SESSION_COOKIE);
  const key = sessionKey();
  if (!raw || !key) return undefined;
  const [id, expires, mac] = raw.split(".");
  if (!id || !expires || !mac) return undefined;
  const expected = Buffer.from(sign(`${id}.${expires}`, key));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return undefined;
  if (Number(expires) < Date.now()) return undefined;
  const userId = Number(id);
  return Number.isInteger(userId) && userId > 0 ? userId : undefined;
}

async function loadSessionUser(req: Request): Promise<User | undefined> {
  const userId = readSessionUserId(req);
  if (!userId) return undefined;
  const user = await db.getUserById(userId);
  if (user && Date.now() - new Date(user.lastSignedIn).getTime() > LAST_SIGNED_IN_REFRESH_MS) {
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  }
  return user;
}

// ---------------------------------------------------------------------------
// Anonymous workspaces
// ---------------------------------------------------------------------------

async function loadUser(workspaceId: string): Promise<User | undefined> {
  const openId = `anon_${workspaceId}`;
  let user = await db.getUserByOpenId(openId);
  if (!user) {
    await db.upsertUser({ openId, name: "Alpha tester", loginMethod: "anonymous", lastSignedIn: new Date() });
    user = await db.getUserByOpenId(openId);
  } else if (Date.now() - new Date(user.lastSignedIn).getTime() > LAST_SIGNED_IN_REFRESH_MS) {
    await db.upsertUser({ openId, lastSignedIn: new Date() });
  }
  return user;
}

/** The anonymous workspace this browser already has, if any (never creates one). */
export async function existingWorkspaceUser(req: Request): Promise<User | undefined> {
  const workspaceId = readWorkspaceId(req);
  return workspaceId ? db.getUserByOpenId(`anon_${workspaceId}`) : undefined;
}

/** Resolve the caller: signed-in user first, else their workspace (created, with its cookie, on first visit). */
export async function getOrCreateWorkspaceUser(req: Request, res: Response): Promise<User | undefined> {
  const signedIn = await loadSessionUser(req);
  if (signedIn) return signedIn;

  let workspaceId = readWorkspaceId(req);
  if (!workspaceId) {
    workspaceId = randomBytes(16).toString("base64url");
    res.cookie(COOKIE_NAME, workspaceId, cookieOptions(req, COOKIE_MAX_AGE_MS));
  }
  return loadUser(workspaceId);
}

/** Resolve the caller's existing user without creating one (e.g. file downloads). */
export async function authenticateRequest(req: Request): Promise<User> {
  const signedIn = await loadSessionUser(req);
  if (signedIn) return signedIn;
  const workspaceId = readWorkspaceId(req);
  if (!workspaceId) throw ForbiddenError("No workspace");
  const user = await loadUser(workspaceId);
  if (!user) throw ForbiddenError("Workspace not found");
  return user;
}
