import { describe, expect, it } from "vitest";
import { evaluateSafe, parseExpression, ExprError } from "@/lib/forms/expr";
import { computeState } from "@/lib/forms/logic";
import { validateSubmission, checkField } from "@/lib/forms/validate";
import { analyze } from "@/lib/forms/analyze";
import { createField, emptyDefinition, options } from "@/lib/forms/fields";
import { FormSchemaV1, type FormDefinition } from "@/lib/forms/schema";

function intake(): FormDefinition {
  const def = emptyDefinition("Mandantenaufnahme");
  const taken = new Set<string>();
  const kind = createField("single_choice", taken, { id: "kind", key: "art", label: "Sie sind", options: [
    { id: "o1", label: "Privatperson", value: "privat" },
    { id: "o2", label: "Unternehmen", value: "unternehmen" },
  ], required: true });
  const company = createField("short_text", taken, { id: "company", key: "firma", label: "Firma", required: true });
  const amount = createField("currency", taken, { id: "amount", key: "betrag", label: "Streitwert" });
  const reason = createField("long_text", taken, { id: "reason", key: "begruendung", label: "Begründung" });
  def.pages = [
    { id: "p1", title: "Start", fields: [kind] },
    { id: "p2", title: "Unternehmen", fields: [company] },
    { id: "p3", title: "Anliegen", fields: [amount, reason] },
  ];
  def.rules = [
    { id: "r1", enabled: true, match: "all", conditions: [{ fieldId: "kind", operator: "eq", value: "unternehmen" }], actions: [{ type: "show", target: "p2" }] },
    { id: "r2", enabled: true, match: "all", conditions: [{ fieldId: "amount", operator: "gt", value: 10000 }], actions: [{ type: "require", target: "reason" }] },
  ];
  return FormSchemaV1.parse(def);
}

describe("Ausdrücke", () => {
  it("rechnet mit Vorrang und Funktionen", () => {
    expect(evaluateSafe("2 + 3 * 4", () => null)).toBe(14);
    expect(evaluateSafe("2 ^ 3 ^ 2", () => null)).toBe(512);
    expect(evaluateSafe("round({a} / 3, 2)", () => 10)).toBe(3.33);
    expect(evaluateSafe("sum({x})", () => [1, 2, 3])).toBe(6);
    expect(evaluateSafe('if({a} > 5, "groß", "klein")', () => 7)).toBe("groß");
    expect(evaluateSafe("1 / 0", () => null)).toBe(null);
  });
  it("lehnt Code ab", () => {
    expect(() => parseExpression("constructor.constructor('x')()")).toThrow(ExprError);
    expect(() => parseExpression("process")).toThrow(ExprError);
    expect(evaluateSafe("this", () => null)).toBe(null);
  });
});

describe("Regel-Engine", () => {
  it("überspringt den Unternehmensbereich für Privatpersonen", () => {
    const def = intake();
    expect(computeState(def, { kind: "privat" }).pages).toEqual(["p1", "p3"]);
    expect(computeState(def, { kind: "unternehmen" }).pages).toEqual(["p1", "p2", "p3"]);
  });
  it("verlangt Begründung ab Betragsgrenze und verwirft verborgene Antworten", () => {
    const def = intake();
    const low = validateSubmission(def, { kind: "privat", company: "Hack GmbH", amount: "5000" });
    expect(low.ok).toBe(true);
    expect(low.values).toEqual({ kind: "privat", amount: 5000 });
    const high = validateSubmission(def, { kind: "privat", amount: "12.500,00" });
    expect(high.ok).toBe(false);
    expect(Object.keys(high.errors)).toEqual(["reason"]);
  });
  it("prüft Pflichtfelder nur, wenn sichtbar", () => {
    const def = intake();
    const r = validateSubmission(def, { kind: "unternehmen" });
    expect(r.errors.company).toBeTruthy();
  });
  it("berechnet Summen über Wiederholgruppen", () => {
    const def = emptyDefinition();
    const taken = new Set<string>();
    const qty = createField("number", taken, { id: "qty", key: "menge", label: "Menge" });
    const group = createField("group", taken, { id: "items", key: "positionen", label: "Positionen", fields: [qty], minItems: 0 });
    const total = createField("calculated", taken, { id: "total", key: "gesamt", label: "Gesamt", expression: "sum({menge}) * 2" });
    def.pages[0].fields = [group, total];
    const r = validateSubmission(FormSchemaV1.parse(def), { items: [{ qty: "2" }, { qty: 3 }] });
    expect(r.ok).toBe(true);
    expect(r.values.total).toBe(10);
  });
});

describe("Feldvalidierung", () => {
  const taken = new Set<string>();
  it("E-Mail, Telefon, Datum", () => {
    expect(checkField(createField("email", taken), "Max@Example.de", true).value).toBe("max@example.de");
    expect(checkField(createField("email", taken), "kein@", true).error).toBeTruthy();
    expect(checkField(createField("phone", taken), "+49 2273 123456", true).error).toBeUndefined();
    expect(checkField(createField("date", taken), "2026-02-30", true).error).toBeTruthy();
  });
  it("Regex läuft linear (kein ReDoS)", () => {
    const f = createField("short_text", taken, { validation: { pattern: "^(a+)+$" } });
    const t = Date.now();
    expect(checkField(f, "a".repeat(5000) + "!", false).error).toBeTruthy();
    expect(Date.now() - t).toBeLessThan(500);
  });
  it("lehnt unbekannte Optionen ab", () => {
    const f = createField("dropdown", taken, { options: options("A", "B") });
    expect(checkField(f, "C", false).error).toBeTruthy();
    expect(checkField(f, "A", false).value).toBe("A");
  });
  it("Mindestalter über relatives Datum", () => {
    const f = createField("date", taken, { validation: { maxDate: "-18y" } });
    const now = new Date("2026-10-22T10:00:00Z");
    expect(checkField(f, "2010-01-01", false, "de", now).error).toContain("Spätestens");
    expect(checkField(f, "2000-01-01", false, "de", now).error).toBeUndefined();
  });
});

describe("Analyse", () => {
  it("erkennt Zyklen, unmögliche Regeln und gelöschte Verweise", () => {
    const def = intake();
    def.rules.push(
      { id: "r3", enabled: true, match: "all", conditions: [{ fieldId: "reason", operator: "not_empty" }], actions: [{ type: "show", target: "amount" }] },
      { id: "r4", enabled: true, match: "all", conditions: [{ fieldId: "amount", operator: "not_empty" }], actions: [{ type: "show", target: "reason" }] },
      { id: "r5", enabled: true, match: "all", conditions: [{ fieldId: "amount", operator: "gt", value: 10 }, { fieldId: "amount", operator: "lt", value: 5 }], actions: [{ type: "require", target: "reason" }] },
      { id: "r6", enabled: true, match: "all", conditions: [{ fieldId: "geloescht", operator: "empty" }], actions: [{ type: "hide", target: "reason" }] },
      { id: "r7", enabled: true, match: "all", conditions: [{ fieldId: "kind", operator: "eq", value: "verein" }], actions: [{ type: "hide", target: "reason" }] },
    );
    const codes = analyze(def).map((i) => i.code);
    expect(codes).toContain("cycle");
    expect(codes).toContain("impossible");
    expect(codes).toContain("bad_condition_ref");
    expect(codes).toContain("unknown_option");
  });
  it("meldet keine Fehler für eine saubere Definition", () => {
    expect(analyze(intake()).filter((i) => i.severity === "error")).toEqual([]);
  });
});

describe("Deutsche Zahlen im Browser (Live-Logik)", () => {
  it("liest Tausenderpunkte wie der Server", async () => {
    const { toNumber } = await import("@/lib/forms/number");
    expect(toNumber("20.000")).toBe(20000);
    expect(toNumber("1.000")).toBe(1000);
    expect(toNumber("12.345,67")).toBe(12345.67);
    expect(toNumber("1234,5")).toBe(1234.5);
    expect(toNumber("1234.5")).toBe(1234.5);
  });
  it("Regel und Formel nutzen dieselbe Lesart", () => {
    const def = intake();
    expect(computeState(def, { kind: "privat", amount: "20.000" }).required.has("reason")).toBe(true);
    const d = emptyDefinition();
    const t = new Set<string>();
    d.pages[0].fields = [
      createField("currency", t, { id: "sw", key: "streitwert" }),
      createField("calculated", t, { id: "fee", key: "gebuehr", expression: "{streitwert} * 0.1" }),
    ];
    expect(computeState(FormSchemaV1.parse(d), { sw: "12.345,67" }).computed.fee).toBeCloseTo(1234.567);
  });
});
