import "server-only";
import { NextResponse } from "next/server";
import { config } from "../config";
import { logError } from "../lib/log";
import type { OidcErrorCode } from "./oidc";

/** Zustands-Cookie nur für die OIDC-Routen. Lax, weil der Anbieter per Top-Level-GET zurückleitet. */
export const oidcStateCookie = {
  name: () => (config().secureCookies ? "__Secure-plica_oidc" : "plica_oidc"),
  // Zum Löschen zusätzlich ein Ablaufdatum: Next.js verwirft maxAge 0, wenn dieselbe Antwort auch cookies() nutzt.
  options: (maxAge: number) => ({ httpOnly: true, secure: config().secureCookies, sameSite: "lax" as const, path: "/api/auth/oidc", maxAge, ...(maxAge === 0 ? { expires: new Date(0) } : {}) }),
};

export function oidcFailure(code: OidcErrorCode, detail?: unknown) {
  if (detail !== undefined) logError(`oidc:${code}`, detail);
  return NextResponse.redirect(new URL(`/login?fehler=${code}`, config().APP_URL), 303);
}
