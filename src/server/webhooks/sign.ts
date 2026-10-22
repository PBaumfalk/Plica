/**
 * Webhook-Signatur: X-Plica-Signature: t=<unix>,v1=<hex(HMAC-SHA256(secret, t + "." + body))>
 * Empfänger prüfen Signatur und Zeitstempel (Schutz vor Wiederholung).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function signatureHeader(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

/** Referenzimplementierung der Prüfung (auch in der Dokumentation). */
export function verifySignature(secret: string, body: string, header: string, toleranceSec = 300, now = Math.floor(Date.now() / 1000)): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(now - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
