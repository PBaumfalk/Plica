// Abläufe 2–6: Formular erstellen, Felder per Drag-and-drop, Logik, Moduswechsel, Veröffentlichen.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { sql } from "./helpers";

/** Zieht ein Palettenelement ans Ende von Seite 1. Das Ziel wird erst nach dem
 *  Aktivieren bestimmt, weil sich das Layout während des Ziehens ändert. */
async function drag(page: Page, from: Locator, sheet: Locator) {
  const a = (await from.boundingBox())!;
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 8, { steps: 5 });
  await page.waitForTimeout(120);
  const fields = sheet.locator("[data-field]");
  const anchor = (await fields.count()) ? fields.last() : sheet.getByLabel("Beschreibung des Formulars");
  const b = (await anchor.boundingBox())!;
  // Unter dem Titelblock liegen 32 px Abstand, darunter die 48 px hohe Ablagezone
  const tx = b.x + b.width / 2, ty = b.y + b.height + ((await fields.count()) ? 20 : 56);
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.move(tx, ty + 2, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(250);
}

test("Formular bauen, Logik setzen, Modus wechseln und veröffentlichen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Neues Formular/ }).first().click();
  const leer = page.getByRole("menuitem", { name: /Leer/ });
  if (await leer.isVisible().catch(() => false)) await leer.click();
  await expect(page).toHaveURL(/\/formulare\/[0-9a-f-]+\/bearbeiten/);
  const formId = page.url().match(/formulare\/([0-9a-f-]+)/)![1];

  await page.getByLabel("Titel des Formulars").first().fill("Rückrufbitte");

  // Felder per Drag-and-drop aus der Palette auf das Blatt ziehen
  const palette = page.getByRole("complementary", { name: "Felder einfügen" });
  const sheet = page.getByRole("region", { name: /^Seite 1/ });
  await drag(page, palette.getByRole("button", { name: /^Einfachauswahl/ }), sheet);
  await drag(page, palette.getByRole("button", { name: /^Kurzer Text/ }), sheet);
  await drag(page, palette.getByRole("button", { name: /^E-Mail/ }), sheet);

  // Drei Felder auf dem Blatt und per Autosave in der Datenbank
  await expect(sheet.locator("[data-field]")).toHaveCount(3);
  await expect
    .poll(async () => {
      const [{ draft }] = await sql()`select draft from forms where id = ${formId}`;
      return (draft.pages[0].fields as { type: string }[]).map((f) => f.type).sort();
    }, { timeout: 15_000 })
    .toEqual(["email", "short_text", "single_choice"]);

  // Bedingte Logik über den Regel-Editor: „Wenn Einfachauswahl ist Option 1, dann zeige Kurzer Text“
  await page.getByRole("tab", { name: "Regeln" }).or(page.getByRole("button", { name: "Regeln", exact: true })).first().click();
  await page.getByRole("button", { name: "Regel anlegen" }).click();
  await expect
    .poll(async () => {
      const [{ draft }] = await sql()`select draft from forms where id = ${formId}`;
      const r = draft.rules[0];
      const byId = Object.fromEntries((draft.pages[0].fields as { id: string; type: string }[]).map((f) => [f.id, f.type]));
      return r ? `${byId[r.conditions[0].fieldId]} ${r.conditions[0].operator} ${r.conditions[0].value} → ${r.actions[0].type} ${byId[r.actions[0].target]}` : "";
    }, { timeout: 15_000 })
    .toBe("single_choice eq Option 1 → show short_text");

  // Moduswechsel ohne Neuaufbau
  for (const mode of ["Cards", "Wizard", "Classic"]) {
    await page.getByRole("radio", { name: mode }).click();
    await expect(page.getByRole("radio", { name: mode })).toHaveAttribute("aria-checked", "true");
  }

  // Veröffentlichen
  await page.getByRole("button", { name: "Veröffentlichen" }).click();
  // Erfolgsdialog mit Link statt flüchtigem Toast
  const done = page.getByRole("dialog", { name: "Dein Formular ist online" });
  await expect(done).toBeVisible({ timeout: 15_000 });
  await expect(done.getByText(/Version 1 ist veröffentlicht/)).toBeVisible();
  const shownUrl = await done.getByLabel("Öffentlicher Link").inputValue();
  await page.keyboard.press("Escape");
  const [{ status, published_version_id }] = await sql()`select status, published_version_id from forms where id = ${formId}`;
  expect(status).toBe("published");
  expect(published_version_id).toBeTruthy();

  // Die Regel wirkt im veröffentlichten Formular
  const [{ slug }] = await sql()`select slug from forms where id = ${formId}`;
  expect(shownUrl.endsWith(`/f/${slug}`), "Dialog zeigt die tatsächliche Adresse").toBe(true);
  const pub = await page.context().browser()!.newPage();
  await pub.goto(`/f/${slug}`);
  await expect(pub.getByLabel("Kurzer Text")).toHaveCount(0);
  await pub.getByText("Option 1", { exact: true }).click();
  await expect(pub.getByLabel("Kurzer Text")).toBeVisible();
  await pub.close();
});
