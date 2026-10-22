/**
 * Einfaches Rate Limiting im Speicher (Fixed Window) und Login-Drossel
 * mit exponentieller Sperre. PLICA läuft als eine Instanz; für mehrere
 * Instanzen müsste dies in Postgres wandern (dokumentiert).
 */
import "server-only";

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 50_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.reset - now) / 1000) };
}

type Fail = { n: number; until: number; last: number };
const fails = new Map<string, Fail>();

/** Ab dem 5. Fehlversuch: Sperre 2^n Sekunden, maximal 15 Minuten. */
export const loginThrottle = {
  check(keys: string[]): number {
    const now = Date.now();
    let wait = 0;
    for (const k of keys) {
      const f = fails.get(k);
      if (f && f.until > now) wait = Math.max(wait, Math.ceil((f.until - now) / 1000));
    }
    return wait;
  },
  fail(keys: string[]) {
    const now = Date.now();
    for (const k of keys) {
      const f = fails.get(k) ?? { n: 0, until: 0, last: now };
      if (now - f.last > 30 * 60_000) f.n = 0;
      f.n++;
      f.last = now;
      if (f.n >= 5) f.until = now + Math.min(2 ** (f.n - 4), 900) * 1000;
      fails.set(k, f);
    }
  },
  succeed(keys: string[]) {
    for (const k of keys) fails.delete(k);
  },
};
