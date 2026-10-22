import "server-only";
import { headers } from "next/headers";
import { config } from "../config";
import { sha256 } from "./crypto";

/**
 * Client-IP für Ratenbegrenzung und Login-Drossel.
 *
 * Maßgeblich ist der LETZTE Eintrag in X-Forwarded-For: Ihn hängt der eigene
 * Reverse Proxy an (nginx: $proxy_add_x_forwarded_for, Caddy). Frühere Einträge
 * kann ein Client frei setzen. Ohne vorgeschalteten Proxy setzt Next.js den
 * Header selbst auf die Socket-Adresse – sofern der Client keinen eigenen
 * mitschickt. Deshalb gilt: Produktion immer hinter einem Proxy mit
 * TRUST_PROXY=true (siehe Handbuch, Reverse Proxy).
 */
export function clientIp(h: Headers): string {
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const last = hops.at(-1);
  if (last) return last.slice(0, 64);
  const real = config().TRUST_PROXY ? h.get("x-real-ip")?.trim() : undefined;
  return real ? real.slice(0, 64) : "unknown";
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
