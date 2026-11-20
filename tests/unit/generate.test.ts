import { describe, expect, it } from "vitest";
import { generateForm, parseDescription } from "@/lib/forms/generate";
import { FormSchemaV1 } from "@/lib/forms/schema";
import { analyze } from "@/lib/forms/analyze";

const types = (text: string) => parseDescription(text).fields.map((f) => f.type);

describe("Formular aus Beschreibung", () => {
  it("Sommerfest-Beispiel", () => {
    const s = parseDescription("Anmeldung für Sommerfest mit Name, E-Mail, Anzahl Personen, vegetarisch ja/nein, Essen (Fleisch, Fisch, Vegan), Datenschutz");
    expect(s.title).toBe("Anmeldung für Sommerfest");
    expect(s.fields.map((f) => f.type)).toEqual(["name", "email", "number", "yes_no", "single_choice", "consent"]);
    expect(s.fields[4].options).toEqual(["Fleisch", "Fisch", "Vegan"]);
    expect(s.fields[3].label).toBe("Vegetarisch");
    expect(s.fields[0].required).toBe(true);
  });

  it("englisch und mit optional", () => {
    expect(types("Contact form with name, email, phone (optional), message and privacy consent")).toEqual(["name", "email", "phone", "long_text", "consent"]);
    const f = parseDescription("Contact form with name, email, phone (optional), message").fields[2];
    expect(f.required).toBe(false);
    expect(f.label).toBe("Telefon");
  });

  it("Kanzlei: Upload, Unterschrift, Geburtsdatum, Mehrfachauswahl", () => {
    expect(types("Mandatsanfrage: Name, Geburtsdatum, Anschrift, Rechtsgebiete mehrere (Arbeitsrecht, Mietrecht, Strafrecht), Sachverhalt beschreiben, Unterlagen hochladen, Unterschrift")).toEqual([
      "name",
      "email",
      "date",
      "address",
      "checkboxes",
      "long_text",
      "file",
      "signature",
      "consent",
    ]);
  });

  it("erzeugt gültige, fehlerfreie Definitionen", () => {
    for (const text of [
      "Anmeldung für Sommerfest mit Name, E-Mail, Anzahl Personen, vegetarisch ja/nein, Datenschutz",
      "Feedback, eine Frage pro Seite: Bewertung, Was war gut?, Was können wir besser machen?",
      "Mehrstufige Bewerbung mit Name, E-Mail, Telefon, Adresse, Eintrittsdatum, Gehalt, Lebenslauf, Zeugnisse, Motivation, Datenschutz",
      "irgendwas",
      "",
    ]) {
      const def = FormSchemaV1.parse(generateForm(text));
      expect(analyze(def).filter((i) => i.severity === "error")).toEqual([]);
    }
  });

  it("Modus aus der Beschreibung", () => {
    expect(generateForm("Feedback, eine Frage pro Seite: Bewertung, Kommentar").settings.mode).toBe("cards");
    const w = generateForm("Mehrstufige Bewerbung mit Name, E-Mail, Telefon, Adresse, Eintrittsdatum, Gehalt, Lebenslauf, Zeugnisse");
    expect(w.settings.mode).toBe("wizard");
    expect(w.pages.length).toBe(2);
  });
});

describe("Generator: Datumswörter und Kontakt", () => {
  it("erkennt zusammengesetzte Datumswörter und ergänzt Kontakt, Pflicht und Einwilligung", async () => {
    const { parseDescription: generateSimple } = await import("@/lib/forms/generate");
    const r = generateSimple("Kündigung melden: Arbeitgeber, Kündigungsdatum, Unfalldatum, Sachverhalt");
    const types = r.fields.map((f) => f.type);
    expect(r.fields.find((f) => /Kündigungsdatum/i.test(f.label))?.type).toBe("date");
    expect(r.fields.find((f) => /Unfalldatum/i.test(f.label))?.type).toBe("date");
    expect(types).toContain("email");
    expect(types).toContain("consent");
    expect(r.fields.find((f) => f.type === "email")?.required).toBe(true);
  });
  it("lässt bei „(ja/nein)“ keine leeren Klammern in der Beschriftung", () => {
    const s = parseDescription("Fragebogen mit Name, gibt es ein Testament (ja/nein), Datenschutz");
    const f = s.fields.find((x) => x.type === "yes_no");
    expect(f?.label).toBe("Gibt es ein Testament");
  });
});
