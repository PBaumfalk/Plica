import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPENAPI } from "@/server/api/openapi";

const root = path.resolve(__dirname, "../../src/app/api/v1");

function routes(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) out.push(...routes(p, `${prefix}/${e.replace(/^\[(.+)\]$/, "{$1}")}`));
    else if (e === "route.ts") out.push(prefix || "/");
  }
  return out;
}

describe("OpenAPI", () => {
  it("dokumentiert jede Route unter /api/v1", () => {
    const documented = new Set(Object.keys(OPENAPI.paths));
    const missing = routes(root).filter((r) => r !== "/openapi.json" && !documented.has(r));
    expect(missing).toEqual([]);
  });
  it("hat Rechte und Scope an jeder Operation", () => {
    for (const [p, ops] of Object.entries(OPENAPI.paths))
      for (const [m, op] of Object.entries(ops as Record<string, Record<string, unknown>>)) {
        expect(op["x-permission"], `${m} ${p}`).toBeTruthy();
        expect(op["x-scope"], `${m} ${p}`).toBeTruthy();
      }
  });
});
