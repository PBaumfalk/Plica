import { describe, expect, it } from "vitest";
import { addPage, duplicateFields, groupFields, locate, mergeWithPrevious, moveField, newField, nudge, removeFields, removePage, ungroup } from "@/components/builder/ops";
import { emptyDefinition } from "@/lib/forms/fields";
import { analyze } from "@/lib/forms/analyze";

function setup() {
  const def = emptyDefinition("Test");
  const a = newField(def, "short_text", { id: "a", label: "A" });
  def.pages[0].fields.push(a);
  const b = newField(def, "email", { id: "b", label: "B" });
  def.pages[0].fields.push(b);
  const c = newField(def, "single_choice", { id: "c", label: "C" });
  def.pages[0].fields.push(c);
  const p2 = addPage(def, 0);
  return { def, p1: def.pages[0].id, p2 };
}

describe("Editor-Operationen", () => {
  it("verschiebt innerhalb einer Seite korrekt nach unten", () => {
    const { def, p1 } = setup();
    moveField(def, "a", `page:${p1}`, 3);
    expect(def.pages[0].fields.map((f) => f.id)).toEqual(["b", "c", "a"]);
  });
  it("verschiebt über Seiten und mit Pfeiltasten über Seitengrenzen", () => {
    const { def, p2 } = setup();
    moveField(def, "b", `page:${p2}`, 0);
    expect(def.pages[1].fields.map((f) => f.id)).toEqual(["b"]);
    nudge(def, "b", -1);
    expect(def.pages[0].fields.map((f) => f.id)).toEqual(["a", "c", "b"]);
  });
  it("gruppiert, verbietet Dateien in Gruppen und löst Gruppen auf", () => {
    const { def } = setup();
    const g = groupFields(def, ["a", "c"])!;
    expect(locate(def, "a")?.parent?.id).toBe(g);
    const file = newField(def, "file", { id: "f" });
    def.pages[0].fields.push(file);
    expect(moveField(def, "f", `group:${g}`, 0)).toBe(false);
    expect(locate(def, "f")?.parent).toBeUndefined();
    ungroup(def, g);
    expect(def.pages[0].fields.map((f) => f.id)).toEqual(["a", "c", "b", "f"]);
  });
  it("entfernt Regeln, die auf gelöschte Felder zeigen", () => {
    const { def } = setup();
    def.rules.push({ id: "r", enabled: true, match: "all", conditions: [{ fieldId: "c", operator: "eq", value: "Option 1" }], actions: [{ type: "show", target: "b" }] });
    removeFields(def, ["c"]);
    expect(def.rules).toEqual([]);
    expect(analyze(def).filter((i) => i.severity === "error")).toEqual([]);
  });
  it("dupliziert mit neuen Schlüsseln", () => {
    const { def } = setup();
    const [id] = duplicateFields(def, ["b"]);
    const copy = locate(def, id)!.field;
    expect(copy.key).not.toBe(locate(def, "b")!.field.key);
    expect(def.pages[0].fields[2].id).toBe(id);
  });
  it("führt Seiten zusammen und löscht nie die letzte Seite", () => {
    const { def, p2 } = setup();
    moveField(def, "a", `page:${p2}`, 0);
    mergeWithPrevious(def, p2);
    expect(def.pages).toHaveLength(1);
    expect(removePage(def, def.pages[0].id)).toBe(false);
  });
});

describe("Bausteine klonen", () => {
  it("schreibt Formelverweise innerhalb des Satzes auf die neuen Schlüssel um", async () => {
    const { cloneFieldSet } = await import("@/components/builder/ops");
    const def = emptyDefinition();
    const price = newField(def, "currency", { key: "preis", label: "Preis" });
    const gross = newField(def, "calculated", { key: "brutto", label: "Brutto", expression: "round({preis} * 1.19, 2) + {extern}" });
    const taken = new Set(["preis", "brutto"]);
    const [p2, g2] = cloneFieldSet([price, gross], taken);
    expect(p2.key).toBe("preis_2");
    expect(g2.expression).toBe("round({preis_2} * 1.19, 2) + {extern}");
  });
});
