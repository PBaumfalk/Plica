/**
 * Krypto-Helfer: Tokens, Hashes, symmetrische Verschlüsselung, HMAC.
 * Schlüssel werden per HKDF aus SECRET_KEY abgeleitet – pro Zweck ein eigener.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { config } from "../config";

const keys = new Map<string, Buffer>();
function key(purpose: string): Buffer {
  let k = keys.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", config().SECRET_KEY, "plica", purpose, 32));
    keys.set(purpose, k);
  }
  return k;
}

export const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Kurze, gut lesbare IDs für Dateien u. Ä. */
export function shortId(len = 20): string {
  const a = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[randomInt(a.length)];
  return s;
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function encrypt(plain: string, purpose = "data"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(purpose), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(token: string, purpose = "data"): string {
  const [v, iv, tag, enc] = token.split(".");
  if (v !== "v1") throw new Error("Unbekanntes Verschlüsselungsformat");
  const d = createDecipheriv("aes-256-gcm", key(purpose), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

export const hmac = (secret: string | Buffer, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** Signierte, ablaufende Kurz-Tokens (z. B. Datei-Downloads, Vorbefüllung). */
export function signPayload(payload: Record<string, unknown>, purpose: string, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString("base64url");
  return `${body}.${createHmac("sha256", key(`sig:${purpose}`)).update(body).digest("base64url")}`;
}

export function verifyPayload<T extends Record<string, unknown>>(token: string, purpose: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key(`sig:${purpose}`)).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    if (data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}
