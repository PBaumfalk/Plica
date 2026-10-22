import { describe, expect, it } from "vitest";
import { TEMPLATES, templateById } from "@/lib/templates";
import { FormSchemaV1, fieldIndex } from "@/lib/forms/schema";
import { analyze } from "@/lib/forms/analyze";
import { computeState } from "@/lib/forms/logic";
import { validateSubmission } from "@/lib/forms/validate";

const byKey = (def: ReturnType<(typeof TEMPLATES)[number]["build"]>, key: string) => [...fieldIndex(def).values()].find((e) => e.field.key === key)!.field;

describe("Vorlagen", () => {
  it("es gibt zehn Vorlagen mit eindeutigen IDs", () => {
    expect(TEMPLATES).toHaveLength(10);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(10);
  });

  for (const t of TEMPLATES) {
    it(`${t.name}: gültig und ohne Analysefehler`, () => {
      const def = FormSchemaV1.parse(t.build());
      const errors = analyze(def).filter((i) => i.severity === "error");
      expect(errors).toEqual([]);
      // jeder Aufruf erzeugt frische IDs
      expect(t.build().pages[0].id).not.toBe(def.pages[0].id);
    });
  }

  it("Mandantenaufnahme unterscheidet Privatperson und Unternehmen", () => {
    const def = FormSchemaV1.parse(templateById("mandantenaufnahme")!.build());
    const art = byKey(def, "art");
    const firma = byKey(def, "firma");
    expect(computeState(def, { [art.id]: "privat" }).visible.has(firma.id)).toBe(false);
    expect(computeState(def, { [art.id]: "unternehmen" }).visible.has(firma.id)).toBe(true);
  });

  it("Mandantenaufnahme: laufende Frist verlangt Datum und wählt die Eil-Abschlussseite", () => {
    const def = FormSchemaV1.parse(templateById("mandantenaufnahme")!.build());
    const frist = [...fieldIndex(def).values()].find((e) => e.field.label === "Läuft eine Frist?")!.field;
    const ende = byKey(def, "fristende");
    const s = computeState(def, { [frist.id]: true });
    expect(s.visible.has(ende.id)).toBe(true);
    expect(s.ending.title).toMatch(/umgehend/);
    const r = validateSubmission(def, { [frist.id]: true });
    expect(r.errors[ende.id]).toBeTruthy();
    expect(computeState(def, { [frist.id]: false }).ending.title).not.toMatch(/umgehend/);
  });

  it("Veranstaltung berechnet den Betrag aus den Begleitpersonen", () => {
    const def = FormSchemaV1.parse(templateById("veranstaltung")!.build());
    const t = byKey(def, "teilnahme");
    const b = [...fieldIndex(def).values()].find((e) => e.field.type === "yes_no" && !e.parent)!.field;
    const g = byKey(def, "begleitpersonen");
    const n = byKey(def, "begleitung_name");
    const betrag = byKey(def, "betrag");
    const s = computeState(def, { [t.id]: "vor_ort", [b.id]: true, [g.id]: [{ [n.id]: "Anna" }, { [n.id]: "Ben" }] });
    expect(s.computed[betrag.id]).toBe(115);
    expect(computeState(def, { [t.id]: "online" }).computed[betrag.id]).toBe(0);
  });

  it("Fragebogen überspringt Erfahrungen für Nicht-Nutzer", () => {
    const def = FormSchemaV1.parse(templateById("fragebogen")!.build());
    const nutzt = [...fieldIndex(def).values()].find((e) => e.field.type === "yes_no")!.field;
    const [p1, p2, p3, p4] = def.pages.map((p) => p.id);
    expect(computeState(def, { [nutzt.id]: false }).pages).toEqual([p1, p3, p4]);
    expect(computeState(def, { [nutzt.id]: true }).pages).toEqual([p1, p2, p4]);
  });
});

describe("Einheitliche Schlüssel", () => {
  it("Name, E-Mail und Telefon heißen in allen Vorlagen gleich", () => {
    for (const t of TEMPLATES) {
      const def = t.build();
      for (const { field, parent } of fieldIndex(def).values()) {
        if (parent) continue;
        const first = [...fieldIndex(def).values()].find((e) => e.field.type === field.type && !e.parent)!.field;
        if (field !== first) continue;
        if (field.type === "email") expect(field.key, t.id).toBe("email");
        if (field.type === "name") expect(field.key, t.id).toBe("name");
        if (field.type === "phone") expect(field.key, t.id).toBe("telefon");
      }
    }
  });
});

describe("Platzhalter", () => {
  it("jeder {{schlüssel}} in Texten verweist auf ein vorhandenes Feld", () => {
    for (const t of TEMPLATES) {
      const def = t.build();
      const keys = new Set([...fieldIndex(def).values()].map((e) => e.field.key));
      const texts = [def.title, def.description ?? "", ...def.endings.flatMap((e) => [e.title, e.body]), ...[...fieldIndex(def).values()].flatMap((e) => [e.field.label, e.field.description ?? ""])];
      for (const s of texts) for (const m of s.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) expect(keys.has(m[1]), `${t.id}: {{${m[1]}}}`).toBe(true);
    }
  });
});
