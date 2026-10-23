/**
 * Rückkehr vom OIDC-Anbieter. Fehler enden nie als JSON, sondern als
 * Weiterleitung auf /login?fehler=<code>; Einzelheiten nur ins Log.
 */
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/server/audit";
import { finishOidcLogin, OidcError, resolveOidcUser } from "@/server/auth/oidc";
import { oidcFailure, oidcStateCookie } from "@/server/auth/oidc-http";
import { cookieName, createSession } from "@/server/auth/session";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { sha256 } from "@/server/lib/crypto";
import { clientIp, ipKey } from "@/server/lib/request";
import { rateLimit } from "@/server/lib/ratelimit";

export async function GET(req: NextRequest) {
  // Der Zustand ist einmalig: Cookie in jedem Fall löschen
  const stateCookie = req.cookies.get(oidcStateCookie.name())?.value;
  const done = (res: NextResponse) => {
    res.cookies.set(oidcStateCookie.name(), "", oidcStateCookie.options(0));
    return res;
  };
  if (!rateLimit(`oidc:${ipKey(clientIp(req.headers))}`, 30, 60_000).ok) return done(oidcFailure("sso_unavailable"));

  let user;
  let next: string;
  let idToken: string | null;
  try {
    const r = await finishOidcLogin(req.nextUrl, stateCookie);
    next = r.next;
    idToken = r.idToken;
    user = await resolveOidcUser(r.claims);
  } catch (e) {
    const code = e instanceof OidcError ? e.code : "sso_failed";
    if (code !== "sso_denied" && code !== "sso_expired") await audit({ action: "login.sso_failed", meta: { reason: code } });
    return done(oidcFailure(code, e));
  }

  // Sitzungsfixierung: eine mitgebrachte Sitzung wird verworfen, die neue bekommt ein frisches Token
  const prev = req.cookies.get(cookieName())?.value;
  if (prev && prev.length <= 100) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(prev)));
  // Das MFA bringt der Anbieter mit; lokales TOTP gilt nur für die Passwort-Anmeldung.
  await createSession(user.id, { viaOidc: true, oidcIdToken: idToken ?? undefined });
  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await audit({ userId: user.id, action: "login.success", meta: { sso: true } });
  return done(NextResponse.redirect(new URL(next, config().APP_URL), 303));
}
