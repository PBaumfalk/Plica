import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let server: http.Server;
let lastAuth: string | undefined;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      lastAuth = req.headers.authorization;
      const prompt = JSON.parse(body).messages[1].content as string;
      res.setHeader("content-type", "application/json");
      if (prompt.includes("kaputt")) return res.end(JSON.stringify({ choices: [{ message: { content: "Das ist kein JSON" } }] }));
      if (prompt.includes("fehler")) {
        res.statusCode = 500;
        return res.end("{}");
      }
      const form = { title: "Rückruf", mode: "classic", fields: [{ type: "name", label: "Name", required: true }, { type: "phone", label: "Telefon", required: true }, { type: "single_choice", label: "Wann?", required: true, options: ["Vormittags", "Nachmittags"] }, { type: "evil_type", label: "x" }] };
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(form) } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    DATABASE_URL: "postgres://x:y@127.0.0.1:1/x",
    APP_URL: "http://localhost:4700",
    SECRET_KEY: "test-0123456789abcdef0123456789abcdef0123456789",
    S3_ACCESS_KEY: "x",
    S3_SECRET_KEY: "y",
    PLICA_ENV: "test",
    AI_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`,
    AI_MODEL: "test-model",
    AI_API_KEY: "test-key",
  });
});
afterAll(() => server.close());

describe("KI-Erzeugung (optional)", () => {
  it("nutzt die KI und baut daraus eine gültige Definition", async () => {
    const { generateDefinition } = await import("@/server/ai/generate");
    const r = await generateDefinition("Rückrufbitte mit Name und Telefon");
    expect(r.source).toBe("ai");
    expect(lastAuth).toBe("Bearer test-key");
    const types = r.definition.pages[0].fields.map((f) => f.type);
    expect(types).toEqual(["name", "phone", "single_choice"]); // unbekannter Typ verworfen
  });
  it("fällt bei unbrauchbarer Antwort auf den eingebauten Generator zurück", async () => {
    const { generateDefinition } = await import("@/server/ai/generate");
    const r = await generateDefinition("kaputt: Formular mit Name, E-Mail");
    expect(r.source).toBe("builtin");
    expect(r.note).toMatch(/eingebaute Generator/);
    expect(r.definition.pages[0].fields.length).toBeGreaterThan(0);
  });
  it("fällt bei Serverfehler zurück", async () => {
    const { generateDefinition } = await import("@/server/ai/generate");
    expect((await generateDefinition("fehler: Name, E-Mail")).source).toBe("builtin");
  });
});
