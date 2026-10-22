import "server-only";
import { headers } from "next/headers";
import { config } from "../config";
import { sha256 } from "./crypto";

/** Client-IP: nur hinter einem vertrauenswürdigen Proxy aus X-Forwarded-For. */
export function clientIp(h: Headers): string {
  if (config().TRUST_PROXY) {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  return "local";
}

/** IP nie im Klartext speichern – nur ein tagesgebundener Hash für Ratenbegrenzung/Spam. */
export const ipKey = (ip: string) => sha256(`${new Date().toISOString().slice(0, 10)}:${ip}`).slice(0, 24);

export async function requestIp(): Promise<string> {
  return clientIp(await headers());
}

export function deviceLabel(ua: string | null): string {
  if (!ua) return "Unbekannt";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return [br, os].filter(Boolean).join(" · ");
}

/**
 * CSRF-Schutz für Route-Handler mit Cookie-Authentifizierung:
 * Origin (falls vorhanden) muss zur eigenen Adresse passen.
 * Server Actions prüfen den Origin bereits selbst.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const allowed = new Set([new URL(config().APP_URL).origin, new URL(config().publicUrl).origin]);
  return allowed.has(origin);
}
