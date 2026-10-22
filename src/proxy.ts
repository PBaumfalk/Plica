/**
 * Läuft vor jeder Anfrage: Sicherheits-Header, Content-Security-Policy mit
 * Nonce, Trennung von öffentlichem Formularbereich und Verwaltung.
 */
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/f/", "/r/", "/api/public/", "/embed.js", "/_next/", "/favicon", "/healthz"];
const isPublicPath = (p: string) => PUBLIC_PREFIXES.some((x) => p.startsWith(x));
const isFramable = (p: string) => p.startsWith("/f/") || p.startsWith("/r/");

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const appHost = hostOf(process.env.APP_URL);
  const publicHost = hostOf(process.env.PUBLIC_URL);
  const host = req.headers.get("host");

  // Auf der öffentlichen Domain gibt es keine Verwaltung.
  if (publicHost && appHost && publicHost !== appHost && host === publicHost && !isPublicPath(path)) {
    return new NextResponse("Nicht gefunden", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const embed = (process.env.EMBED_ORIGINS ?? "*").trim() || "*";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Radix/Floating UI positionieren über style-Attribute.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    `frame-ancestors ${isFramable(path) ? (embed === "*" ? "*" : embed) : "'none'"}`,
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  res.headers.set("x-content-type-options", "nosniff");
  res.headers.set("referrer-policy", isPublicPath(path) ? "no-referrer" : "same-origin");
  res.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.headers.set("cross-origin-opener-policy", "same-origin");
  if (!isFramable(path)) res.headers.set("x-frame-options", "DENY");
  if (isPublicPath(path)) res.headers.set("x-robots-tag", "noindex, nofollow");
  if (process.env.APP_URL?.startsWith("https://")) res.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  if (path.startsWith("/api/")) res.headers.set("cache-control", "no-store");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
