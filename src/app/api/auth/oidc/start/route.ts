/**
 * Startet die Anmeldung über den OIDC-Anbieter. Der Zustand (PKCE-Verifier,
 * state, nonce, Rücksprungziel) liegt verschlüsselt in einem kurzlebigen Cookie.
 */
import { NextResponse, type NextRequest } from "next/server";
import { beginOidcLogin, OidcError } from "@/server/auth/oidc";
import { oidcStateCookie, oidcFailure } from "@/server/auth/oidc-http";
import { clientIp, ipKey } from "@/server/lib/request";
import { rateLimit } from "@/server/lib/ratelimit";

export async function GET(req: NextRequest) {
  if (!rateLimit(`oidc:${ipKey(clientIp(req.headers))}`, 30, 60_000).ok) return oidcFailure("sso_unavailable");
  try {
    const { url, stateCookie } = await beginOidcLogin(req.nextUrl.searchParams.get("next"));
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(oidcStateCookie.name(), stateCookie, oidcStateCookie.options(600));
    return res;
  } catch (e) {
    return oidcFailure(e instanceof OidcError ? e.code : "sso_failed", e);
  }
}
