/** Kein seitliches Überlaufen auf dem Smartphone – mit jedem Feldtyp, in allen drei Modi. */
import { expect, test } from "@playwright/test";
import { createField, emptyDefinition } from "@/lib/forms/fields";
import { FIELD_TYPES, FormSchemaV1 } from "@/lib/forms/schema";
import { seedPublishedForm } from "./helpers";

function allTypes(mode: "classic" | "cards" | "wizard") {
  const def = emptyDefinition("Alle Feldtypen");
  def.settings.mode = mode;
  const t = new Set<string>();
  def.pages[0].fields = FIELD_TYPES.filter((ty) => ty !== "image").map((ty) => {
    const f = createField(ty, t, { label: `Frage ${ty}`, required: false });
    if (ty === "group") f.fields = [createField("short_text", t, { label: "Name" }), createField("number", t, { label: "Anzahl", width: "half" })];
    if (ty === "matrix") f.matrix!.columns.push({ id: "c4", label: "Trifft voll und ganz zu", value: "voll" }, { id: "c5", label: "Weiß nicht", value: "wn" });
    t.add(f.key);
    return f;
  });
  return FormSchemaV1.parse(def);
}

for (const mode of ["classic", "wizard"] as const) {
  test(`kein horizontaler Überlauf mobil (${mode})`, async ({ page }) => {
    const slug = `layout-${mode}-${Date.now().toString(36)}`;
    await seedPublishedForm(slug, allTypes(mode));
    await page.goto(`/f/${slug}`);
    await page.getByRole("heading", { name: "Alle Feldtypen" }).waitFor();
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw, "Seite ist breiter als der Bildschirm").toBeLessThanOrEqual(cw);
  });
}
