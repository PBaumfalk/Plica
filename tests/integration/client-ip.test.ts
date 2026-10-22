import { describe, expect, it } from "vitest";
import { clientIp } from "@/server/lib/request";

const h = (o: Record<string, string>) => new Headers(o);

describe("clientIp", () => {
  it("nimmt den vom eigenen Proxy angehängten letzten Eintrag – nicht den vom Client gefälschten ersten", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("ohne Proxy: von Next gesetzte Socket-Adresse statt eines gemeinsamen Topfes", () => {
    expect(clientIp(h({ "x-forwarded-for": "192.0.2.10" }))).toBe("192.0.2.10");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
