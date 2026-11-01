import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

// Alpha: no login. Each browser gets an anonymous workspace identified by a
// random, unguessable cookie value. users.openId stores "anon_<id>".
const COOKIE_NAME = "itcp_workspace";
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const ID_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

// Avoid a DB write on every request; refresh lastSignedIn at most hourly
const LAST_SIGNED_IN_REFRESH_MS = 60 * 60 * 1000;

function readWorkspaceId(req: Request): string | undefined {
  if (!req.headers.cookie) return undefined;
  const id = parseCookieHeader(req.headers.cookie)[COOKIE_NAME];
  return id && ID_PATTERN.test(id) ? id : undefined;
}

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

/** Resolve the caller's workspace user, creating the workspace (and cookie) on first visit. */
export async function getOrCreateWorkspaceUser(req: Request, res: Response): Promise<User | undefined> {
  let workspaceId = readWorkspaceId(req);
  if (!workspaceId) {
    workspaceId = randomBytes(16).toString("base64url");
    res.cookie(COOKIE_NAME, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      path: "/",
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }
  return loadUser(workspaceId);
}

/** Resolve the caller's existing workspace user without creating one (e.g. file downloads). */
export async function authenticateRequest(req: Request): Promise<User> {
  const workspaceId = readWorkspaceId(req);
  if (!workspaceId) throw ForbiddenError("No workspace");
  const user = await loadUser(workspaceId);
  if (!user) throw ForbiddenError("Workspace not found");
  return user;
}
