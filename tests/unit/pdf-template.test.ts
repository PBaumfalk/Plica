import { describe, expect, it } from "vitest";
import { parseTemplate } from "@/server/pdf/template";

const r = (n: string) => ({ name: "Max **Mustermann**", nummer: "7" })[n] ?? "";

describe("PDF-Vorlagen", () => {
  it("parst Überschriften, Absätze, Listen und Spezialblöcke", () => {
    const b = parseTemplate("# Titel {{nummer}}\n\nHallo **{{name}}**\nZweite Zeile\n\n- eins\n- zwei\n---\n{{antworten}}\n{{unterschrift:sig}}", r);
    expect(b.map((x) => x.t)).toEqual(["h", "p", "list", "hr", "answers", "signature"]);
    expect(b[0]).toEqual({ t: "h", level: 1, inl: [{ text: "Titel 7" }] });
    const p = b[1] as Extract<(typeof b)[number], { t: "p" }>;
    expect(p.lines).toHaveLength(2);
    // Eingaben bleiben wörtlich – kein Markup aus Antworten
    expect(p.lines[0]).toEqual([{ text: "Hallo " }, { text: "Max **Mustermann**", bold: true }]);
  });
  it("unbekannte Platzhalter werden leer", () => {
    expect(parseTemplate("{{gibtsnicht}}x", r)).toEqual([{ t: "p", lines: [[{ text: "x" }]] }]);
  });
});
