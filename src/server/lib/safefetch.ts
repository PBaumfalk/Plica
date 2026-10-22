/**
 * SSRF-sicherer HTTP-Client für Webhooks.
 *
 * - nur http/https, nur Standardports oder ≥ 1024
 * - DNS wird selbst aufgelöst; ALLE Adressen müssen erlaubt sein
 * - Verbindung wird auf die geprüfte IP festgenagelt (kein DNS-Rebinding),
 *   Host-Header und TLS-SNI bleiben der Hostname
 * - jede Weiterleitung wird erneut geprüft, Zeit- und Größenlimit
 */
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8], ["2001:db8::", 32], ["100::", 64],
] as const) blocked.addSubnet(addr, prefix, "ipv6");

/** IPv4 aus IPv4-mapped (::ffff:a.b.c.d) bzw. NAT64 (64:ff9b::/96) herauslösen. */
function embeddedV4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const m = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (m) return m[1];
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const a = parseInt(hex[1], 16);
    const b = parseInt(hex[2], 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return null;
}

export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return blocked.check(ip, "ipv4");
  if (v === 6) {
    const v4 = embeddedV4(ip);
    if (v4) return blocked.check(v4, "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true; // keine gültige IP → nicht erlauben
}

export class SafeFetchError extends Error {
  constructor(message: string, public retryable: boolean) {
    super(message);
  }
}

export interface SafeFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  allowPrivate?: boolean;
}

export interface SafeFetchResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  url: string;
}

export async function resolveAllowed(hostname: string, allowPrivate: boolean): Promise<{ address: string; family: 4 | 6 }> {
  const host = hostname.replace(/^\[|\]$/g, "");
  let addrs: { address: string; family: number }[];
  if (net.isIP(host)) addrs = [{ address: host, family: net.isIP(host) }];
  else {
    try {
      addrs = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new SafeFetchError(`Der Server „${host}“ wurde nicht gefunden.`, true);
    }
  }
  if (addrs.length === 0) throw new SafeFetchError(`Der Server „${host}“ wurde nicht gefunden.`, true);
  if (!allowPrivate && addrs.some((a) => isPrivateAddress(a.address)))
    throw new SafeFetchError(`Ziel „${host}“ liegt in einem privaten oder internen Netz und ist gesperrt (WEBHOOK_ALLOW_PRIVATE).`, false);
  return { address: addrs[0].address, family: addrs[0].family === 6 ? 6 : 4 };
}

export function checkUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SafeFetchError("Die Adresse ist ungültig.", false);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new SafeFetchError("Nur http:// und https:// sind erlaubt.", false);
  if (u.username || u.password) throw new SafeFetchError("Zugangsdaten in der Adresse sind nicht erlaubt.", false);
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443 && port < 1024) throw new SafeFetchError("Dieser Port ist nicht erlaubt.", false);
  return u;
}

function once(u: URL, pinned: { address: string; family: 4 | 6 }, opts: SafeFetchOptions): Promise<SafeFetchResponse> {
  const mod = u.protocol === "https:" ? https : http;
  const maxBytes = opts.maxBytes ?? 256 * 1024;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname.replace(/^\[|\]$/g, ""),
        port: u.port || undefined,
        path: `${u.pathname}${u.search}`,
        method: opts.method ?? "GET",
        headers: { "user-agent": "PLICA-Webhook/1", ...opts.headers, ...(opts.body !== undefined ? { "content-length": String(Buffer.byteLength(opts.body)) } : {}) },
        // IP festnageln: Hostname wird nicht erneut aufgelöst
        lookup: ((_h: string, o: { all?: boolean }, cb: (...args: unknown[]) => void) =>
          o?.all ? cb(null, [{ address: pinned.address, family: pinned.family }]) : cb(null, pinned.address, pinned.family)) as unknown as net.LookupFunction,
        timeout: opts.timeoutMs ?? 10_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          // Über dem Limit nur noch verwerfen (abschneiden), die Zustellung zählt trotzdem.
          if (size < maxBytes) chunks.push(c.subarray(0, maxBytes - size));
          size += c.length;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8"), url: u.toString() }));
        res.on("error", (e) => reject(new SafeFetchError(`Verbindung abgebrochen: ${e.message}`, true)));
      },
    );
    req.on("timeout", () => req.destroy(new SafeFetchError("Zeitüberschreitung – der Server hat nicht rechtzeitig geantwortet.", true)));
    req.on("error", (e) => reject(e instanceof SafeFetchError ? e : new SafeFetchError(`Verbindung fehlgeschlagen: ${(e as NodeJS.ErrnoException).code ?? e.message}`, true)));
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  let u = checkUrl(raw);
  const allowPrivate = !!opts.allowPrivate;
  let current = { ...opts };
  for (let hop = 0; hop <= (opts.maxRedirects ?? 3); hop++) {
    const pinned = await resolveAllowed(u.hostname, allowPrivate);
    const res = await once(u, pinned, current);
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
      u = checkUrl(new URL(String(res.headers.location), u).toString());
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && current.method === "POST")) current = { ...current, method: "GET", body: undefined };
      continue;
    }
    return res;
  }
  throw new SafeFetchError("Zu viele Weiterleitungen.", false);
}
