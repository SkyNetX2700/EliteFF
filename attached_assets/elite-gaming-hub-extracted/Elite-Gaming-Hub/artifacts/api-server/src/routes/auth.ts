import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const HOST_EMAILS = new Set(["venomx2424@gmail.com", "daredevilx2424@gmail.com"]);
const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

// ─── Backward-compat middleware exports for other routes ─────────────────────

export function getAuthMiddleware() {
  return (req: Request, res: Response, next: any) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    next();
  };
}

export function getHostMiddleware() {
  return (req: Request, res: Response, next: any) => {
    if (req.userRole !== "host") {
      res.status(403).json({ message: "Host access required" });
      return;
    }
    next();
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const email = (claims.email as string) || null;
  const firstName = (claims.first_name as string) || (claims.given_name as string) || null;
  const lastName = (claims.last_name as string) || (claims.family_name as string) || null;
  const sub = claims.sub as string;
  const profileImageUrl = ((claims.profile_image_url || claims.picture) as string) || null;

  const isHost = email ? HOST_EMAILS.has(email.toLowerCase()) : false;
  const role = isHost ? "host" : "player";
  const username = firstName
    ? [firstName, lastName].filter(Boolean).join(" ")
    : email
    ? email.split("@")[0]
    : `user_${sub.substring(0, 8)}`;

  // Look up existing user by email
  if (email) {
    const [existing] = await db.select().from(usersTable)
      .where(eq(usersTable.email, email)).limit(1);
    if (existing) {
      if (existing.role !== role) {
        await db.update(usersTable).set({ role }).where(eq(usersTable.id, existing.id));
      }
      return { ...existing, role, isHost, profileImageUrl };
    }
  }

  // Also check by sub stored in mobile field
  const subKey = `oidc_${sub.substring(0, 12)}`;
  const [bySub] = await db.select().from(usersTable)
    .where(eq(usersTable.mobile, subKey)).limit(1);
  if (bySub) {
    if (bySub.role !== role) {
      await db.update(usersTable).set({ role, email }).where(eq(usersTable.id, bySub.id));
    }
    return { ...bySub, role, isHost, profileImageUrl };
  }

  // Create new user
  const [user] = await db.insert(usersTable).values({
    username,
    email,
    mobile: subKey,
    passwordHash: "$oidc$",
    role,
    loginMethod: "oidc",
  }).returning();

  return { ...user, isHost, profileImageUrl };
}

// ─── Auth routes ─────────────────────────────────────────────────────────────

router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

router.get("/login", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;
    const returnTo = getSafeReturnTo(req.query.returnTo);

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

    const redirectTo = oidc.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile offline_access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login consent",
      state,
      nonce,
    });

    setOidcCookie(res, "code_verifier", codeVerifier);
    setOidcCookie(res, "nonce", nonce);
    setOidcCookie(res, "state", state);
    setOidcCookie(res, "return_to", returnTo);

    res.redirect(redirectTo.href);
  } catch (err: any) {
    req.log.error({ err }, "Login initiation error");
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/callback", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const callbackUrl = `${getOrigin(req)}/api/callback`;

    const codeVerifier = req.cookies?.code_verifier;
    const nonce = req.cookies?.nonce;
    const expectedState = req.cookies?.state;

    if (!codeVerifier || !expectedState) {
      res.redirect("/api/login");
      return;
    }

    const currentUrl = new URL(
      `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
    );

    let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
    try {
      tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedNonce: nonce,
        expectedState,
        idTokenExpected: true,
      });
    } catch {
      res.redirect("/api/login");
      return;
    }

    const returnTo = getSafeReturnTo(req.cookies?.return_to);
    res.clearCookie("code_verifier", { path: "/" });
    res.clearCookie("nonce", { path: "/" });
    res.clearCookie("state", { path: "/" });
    res.clearCookie("return_to", { path: "/" });

    const claims = tokens.claims();
    if (!claims) { res.redirect("/api/login"); return; }

    const dbUser = await upsertUser(claims as unknown as Record<string, unknown>);
    const now = Math.floor(Date.now() / 1000);

    const sessionData: SessionData = {
      user: {
        dbId: dbUser.id,
        email: dbUser.email ?? null,
        username: dbUser.username,
        isHost: dbUser.isHost,
        profileImageUrl: dbUser.profileImageUrl ?? null,
      },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : (claims.exp as number | undefined),
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.redirect(returnTo);
  } catch (err: any) {
    req.log.error({ err }, "Callback error");
    res.redirect("/api/login");
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  try {
    const config = await getOidcConfig();
    const origin = getOrigin(req);
    const sid = getSessionId(req);
    await clearSession(res, sid);

    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: process.env.REPL_ID!,
      post_logout_redirect_uri: origin,
    });
    res.redirect(endSessionUrl.href);
  } catch {
    res.redirect("/");
  }
});

export default router;
