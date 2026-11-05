import { randomBytes } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { clearSession, cookieOptions, existingWorkspaceUser, setSession } from "./auth";
import { ENV } from "./env";

// Google sign-in (OpenID Connect authorization-code flow). Optional: the routes
// only work when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. On first
// sign-in the browser's anonymous workspace becomes the Google account's, so
// nothing made before signing in is lost.
const STATE_COOKIE = "itcp_oauth";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const googleConfigured = () => Boolean(ENV.googleClientId && ENV.googleClientSecret);

function callbackUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
}

/** Only same-site paths, so the sign-in flow can't be used as an open redirect. */
function safeReturnTo(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

function withError(returnTo: string, code: string): string {
  return `${returnTo}${returnTo.includes("?") ? "&" : "?"}auth_error=${code}`;
}

export type GoogleProfile = { sub: string; email?: string; emailVerified: boolean; name?: string };

/** Exchange the authorization code and read the ID token Google returns over TLS. */
async function exchangeCode(code: string, redirectUri: string): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  const { id_token } = (await response.json()) as { id_token?: string };
  if (!id_token) throw new Error("No ID token in response");

  // The token came straight from Google's token endpoint, so per OIDC we only
  // need to check its claims, not its signature.
  const claims = JSON.parse(Buffer.from(id_token.split(".")[1] ?? "", "base64url").toString());
  if (claims.aud !== ENV.googleClientId) throw new Error("ID token audience mismatch");
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("ID token issuer mismatch");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now()) throw new Error("ID token expired");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("ID token has no subject");

  return {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    emailVerified: claims.email_verified === true || claims.email_verified === "true",
    name: typeof claims.name === "string" ? claims.name : undefined,
  };
}

/** Find or create the user for a Google account, adopting the browser's anonymous workspace if it's new. */
export async function signInWithGoogle(profile: GoogleProfile, req: Request) {
  const openId = `google_${profile.sub}`;
  const email = profile.emailVerified ? profile.email?.toLowerCase() : undefined;
  const details = {
    openId,
    name: profile.name ?? email ?? "Google user",
    email: email ?? null,
    loginMethod: "google",
    lastSignedIn: new Date(),
    ...(email && ENV.ownerEmail && email === ENV.ownerEmail ? { role: "admin" as const } : {}),
  };

  if (!(await db.getUserByOpenId(openId))) {
    const workspace = await existingWorkspaceUser(req);
    if (workspace) await db.relinkUserOpenId(workspace.id, openId);
  }
  await db.upsertUser(details);
  return db.getUserByOpenId(openId);
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const returnTo = safeReturnTo(req.query.returnTo);
    if (!googleConfigured()) {
      res.redirect(withError(returnTo, "not_configured"));
      return;
    }
    const state = randomBytes(16).toString("base64url");
    res.cookie(STATE_COOKIE, `${state}.${Buffer.from(returnTo).toString("base64url")}`, cookieOptions(req, STATE_MAX_AGE_MS));
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: callbackUrl(req),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    res.redirect(`${AUTH_URL}?${params}`);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const stored = req.headers.cookie ? parseCookieHeader(req.headers.cookie)[STATE_COOKIE] : undefined;
    res.clearCookie(STATE_COOKIE, { ...cookieOptions(req, 0), maxAge: undefined });
    const [state, encodedReturn] = stored?.split(".") ?? [];
    const returnTo = safeReturnTo(encodedReturn ? Buffer.from(encodedReturn, "base64url").toString() : "/");

    if (req.query.error) {
      res.redirect(withError(returnTo, req.query.error === "access_denied" ? "cancelled" : "google_error"));
      return;
    }
    if (!state || req.query.state !== state || typeof req.query.code !== "string") {
      res.redirect(withError(returnTo, "invalid_state"));
      return;
    }

    try {
      const profile = await exchangeCode(req.query.code, callbackUrl(req));
      const user = await signInWithGoogle(profile, req);
      if (!user) throw new Error("User not saved");
      setSession(req, res, user.id);
      res.redirect(returnTo);
    } catch (error) {
      console.error("[Auth] Google sign-in failed", error);
      res.redirect(withError(returnTo, "failed"));
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    clearSession(req, res);
    res.json({ ok: true });
  });
}
