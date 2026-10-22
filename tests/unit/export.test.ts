import { describe, expect, it } from "vitest";
import { csvCell, csvLine, neutralize } from "@/server/export/csv";
import { cellText, unionColumns } from "@/server/export/columns";
import { createField, emptyDefinition, options } from "@/lib/forms/fields";
import type { FormDefinition } from "@/lib/forms/schema";

describe("CSV", () => {
  it("neutralisiert Formeln, lässt Zahlen in Ruhe", () => {
    expect(neutralize("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(neutralize("+49 2273")).toBe("+49 2273"); // Telefonnummer, keine Formel
    expect(neutralize("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralize("\tcmd")).toBe("'\tcmd");
    expect(neutralize("-5")).toBe("-5");
    expect(neutralize("-1,5")).toBe("-1,5");
    expect(neutralize("Max")).toBe("Max");
  });
  it("quotet Trennzeichen, Anführungszeichen und Zeilenumbrüche", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('sagt "hallo"')).toBe('"sagt ""hallo"""');
    expect(csvCell("zwei\nZeilen")).toBe('"zwei\nZeilen"');
    expect(csvLine(["1", "=1+1"])).toBe("1;'=1+1\r\n");
  });
});

describe("Spalten über Versionen", () => {
  it("vereinigt Felder, neueste Reihenfolge zuerst, alte Felder hinten", () => {
    const taken = new Set<string>();
    const name = createField("short_text", taken, { id: "name", label: "Name" });
    const old = createField("short_text", taken, { id: "fax", label: "Fax" });
    const kind = createField("dropdown", taken, { id: "kind", label: "Art", options: options("A", "B") });
    const v1: FormDefinition = { ...emptyDefinition(), pages: [{ id: "p", title: "", fields: [name, old] }] };
    const v2: FormDefinition = { ...emptyDefinition(), pages: [{ id: "p", title: "", fields: [kind, { ...name, label: "Vollständiger Name" }, createField("heading", taken)] }] };
    const cols = unionColumns([{ definition: v1 }, { definition: v2 }]);
    expect(cols.map((c) => c.fieldId)).toEqual(["kind", "name", "fax"]);
    expect(cols[1].label).toBe("Vollständiger Name");
    // Formatierung mit der Definition der eigenen Version
    const v1Kind = { ...v1, pages: [{ id: "p", title: "", fields: [{ ...kind, options: [{ id: "x", label: "Alt-A", value: "A" }] }] }] };
    expect(cellText(v1Kind, cols[0], { kind: "A" })).toBe("Alt-A");
    expect(cellText(undefined, cols[0], { kind: "A" })).toBe("A");
  });
});

describe("XLSX-Eingangszeit", () => {
  it("zeigt Berliner Wanduhrzeit (Sommer- und Winterzeit)", async () => {
    const { berlinWallClock } = await import("@/lib/time");
    expect(berlinWallClock(new Date("2026-10-22T09:02:00Z")).toISOString()).toBe("2026-10-22T11:02:00.000Z");
    expect(berlinWallClock(new Date("2026-12-01T09:02:00Z")).toISOString()).toBe("2026-12-01T10:02:00.000Z");
  });
});

describe("CSV-Telefonnummern", () => {
  it("lässt +49-Nummern unverändert, neutralisiert aber Formeln", async () => {
    const { neutralize } = await import("@/server/export/csv");
    expect(neutralize("+49 2273 123456")).toBe("+49 2273 123456");
    expect(neutralize("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(neutralize("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
  });
});
