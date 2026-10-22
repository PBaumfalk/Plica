import { describe, expect, it } from "vitest";
import { signatureHeader, verifySignature } from "@/server/webhooks/sign";
import { checkUrl, isPrivateAddress, SafeFetchError } from "@/server/lib/safefetch";

describe("Webhook-Signatur", () => {
  it("signiert und prüft", () => {
    const body = JSON.stringify({ a: 1, ä: "ü" });
    const h = signatureHeader("geheim", body, 1_800_000_000);
    expect(h).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(verifySignature("geheim", body, h, 300, 1_800_000_100)).toBe(true);
  });
  it("lehnt Manipulation, falsches Geheimnis und alte Zeitstempel ab", () => {
    const h = signatureHeader("geheim", "{}", 1_800_000_000);
    expect(verifySignature("geheim", "{ }", h, 300, 1_800_000_000)).toBe(false);
    expect(verifySignature("anders", "{}", h, 300, 1_800_000_000)).toBe(false);
    expect(verifySignature("geheim", "{}", h, 300, 1_800_000_301)).toBe(false);
    expect(verifySignature("geheim", "{}", "t=x,v1=y")).toBe(false);
  });
});

describe("SSRF-Schutz", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.178.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::a9fe:a9fe", "224.0.0.1", "nicht-ip",
  ])("sperrt %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2a00:1450:4001:80b::200e", "::ffff:8.8.8.8"])("erlaubt %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
  it("prüft Schema, Zugangsdaten und Ports", () => {
    expect(() => checkUrl("file:///etc/passwd")).toThrow(SafeFetchError);
    expect(() => checkUrl("gopher://x")).toThrow(SafeFetchError);
    expect(() => checkUrl("https://user:pw@example.com")).toThrow(SafeFetchError);
    expect(() => checkUrl("http://example.com:25/")).toThrow(SafeFetchError);
    expect(checkUrl("https://example.com:8443/hook").port).toBe("8443");
  });
});
