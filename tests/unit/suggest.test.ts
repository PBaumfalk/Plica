import { describe, expect, it } from "vitest";
import { suggestFields } from "@/lib/forms/suggest";
import { createField, emptyDefinition } from "@/lib/forms/fields";

function def(...types: Parameters<typeof createField>[0][]) {
  const d = emptyDefinition("Kontakt");
  const taken = new Set<string>();
  d.pages[0].fields = types.map((t) => createField(t, taken));
  return d;
}

describe("Feldvorschläge", () => {
  it("schlägt eine Einwilligung vor, wenn personenbezogene Daten erfasst werden", () => {
    expect(suggestFields(def("email", "long_text")).map((s) => s.id)).toContain("privacy-consent");
    expect(suggestFields(def("email", "consent")).map((s) => s.id)).not.toContain("privacy-consent");
  });
  it("schlägt E-Mail vor, wenn nur ein Name vorhanden ist", () => {
    expect(suggestFields(def("name")).map((s) => s.id)).toContain("email");
  });
  it("schlägt Ort bei Unterschriften vor", () => {
    expect(suggestFields(def("name", "email", "consent", "signature"), 5).map((s) => s.id)).toContain("place");
  });
  it("liefert für ein leeres Formular nichts und höchstens max Vorschläge", () => {
    expect(suggestFields(emptyDefinition())).toEqual([]);
    expect(suggestFields(def("signature", "file"), 2)).toHaveLength(2);
  });
});
