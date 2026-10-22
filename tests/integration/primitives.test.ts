/**
 * Sicherheitsbausteine: Verschlüsselung, Signaturen, CSRF-Herkunft,
 * Ratenbegrenzung, Login-Drossel, Request-Größe, Slugs, Passwörter.
 */
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, safeEqual, signPayload, verifyPayload } from "@/server/lib/crypto";
import { readJson, tooLarge } from "@/server/lib/http";
import { loginThrottle, rateLimit } from "@/server/lib/ratelimit";
import { sameOrigin } from "@/server/lib/request";
import { slugProblem } from "@/server/forms/service";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";

describe("Verschlüsselung und Signaturen", () => {
  it("AES-GCM: Rundlauf, Manipulation und Zweckbindung", () => {
    const c = encrypt("Mandantengeheimnis", "data");
    expect(c).not.toContain("Mandant");
    expect(decrypt(c, "data")).toBe("Mandantengeheimnis");
    const parts = c.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(parts.join("."), "data")).toThrow();
    expect(() => decrypt(c, "totp")).toThrow();
  });
  it("signierte Tokens: Ablauf, Manipulation, Zweck", () => {
    const t = signPayload({ f: "x" }, "unlock", 60);
    expect(verifyPayload<{ f: string }>(t, "unlock")?.f).toBe("x");
    expect(verifyPayload(t, "form")).toBeNull();
    expect(verifyPayload(signPayload({ f: "x" }, "unlock", -1), "unlock")).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ f: "admin", exp: 9e9 })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`, "unlock")).toBeNull();
    expect(verifyPayload(`${body}.`, "unlock")).toBeNull();
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("CSRF: Herkunftsprüfung", () => {
  const req = (h: Record<string, string>) => new Request("http://localhost:4700/api/public/forms/x/submit", { method: "POST", headers: h });
  it("akzeptiert eigene Herkunft, lehnt fremde ab", () => {
    expect(sameOrigin(req({ origin: "http://localhost:4700" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(req({ origin: "http://localhost:4700.evil.example" }))).toBe(false);
    expect(sameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(sameOrigin(req({ "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});

describe("Ratenbegrenzung und Login-Drossel", () => {
  it("begrenzt pro Fenster", () => {
    const k = `t:${Math.random()}`;
    for (let i = 0; i < 10; i++) expect(rateLimit(k, 10, 60_000).ok).toBe(true);
    const r = rateLimit(k, 10, 60_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
  });
  it("sperrt nach dem 5. Fehlversuch exponentiell und gibt nach Erfolg frei", () => {
    const keys = [`acct:${Math.random()}`];
    for (let i = 0; i < 4; i++) loginThrottle.fail(keys);
    expect(loginThrottle.check(keys)).toBe(0);
    loginThrottle.fail(keys);
    expect(loginThrottle.check(keys)).toBeGreaterThan(0);
    loginThrottle.succeed(keys);
    expect(loginThrottle.check(keys)).toBe(0);
  });
});

describe("Übergroße Requests", () => {
  it("lehnt per Content-Length und tatsächlicher Länge ab", async () => {
    const small = new Request("http://x/", { method: "POST", body: '{"a":1}', headers: { "content-length": "7" } });
    expect(await readJson(small, 100)).toEqual({ a: 1 });
    const big = new Request("http://x/", { method: "POST", body: "x".repeat(200), headers: { "content-length": "200" } });
    expect(tooLarge(big, 100)).toBe(true);
    expect(await readJson(big, 100)).toBeNull();
    const lying = new Request("http://x/", { method: "POST", body: `"${"x".repeat(300)}"`, headers: { "content-length": "5" } });
    expect(await readJson(lying, 100)).toBeNull();
  });
});

describe("Eingaberegeln", () => {
  it("Slugs", () => {
    expect(slugProblem("kontakt")).toBeNull();
    expect(slugProblem("../admin")).not.toBeNull();
    expect(slugProblem("admin")).not.toBeNull();
    expect(slugProblem("Großbuchstaben")).not.toBeNull();
    expect(slugProblem("a")).not.toBeNull();
  });
  it("Passwörter: Richtlinie und Argon2id", async () => {
    expect(passwordProblem("kurz")).not.toBeNull();
    expect(passwordProblem("password123")).not.toBeNull();
    expect(passwordProblem("erika.muster-geheim", "erika.muster@example.de")).not.toBeNull();
    expect(passwordProblem("Lange Sätze sind sicher")).toBeNull();
    const h = await hashPassword("Lange Sätze sind sicher");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(h, "Lange Sätze sind sicher")).toBe(true);
    expect(await verifyPassword(h, "falsch")).toBe(false);
    expect(await verifyPassword(null, "egal")).toBe(false);
  });
});
