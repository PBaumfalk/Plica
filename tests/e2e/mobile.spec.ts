// Ablauf 8: Ein externer Nutzer füllt das Formular mobil aus (iPhone 13, Cards-Modus).
import { expect, test } from "@playwright/test";
import { humanPause, intakeDefinition, seedPublishedForm, submissionsOf } from "./helpers";

test("Mobil im Kartenmodus ausfüllen und absenden", async ({ page }) => {
  const def = intakeDefinition("cards");
  def.pages[1].fields = def.pages[1].fields.filter((f) => f.type !== "file");
  const { formId } = await seedPublishedForm("mobil-karten", def);
  await page.goto("/f/mobil-karten");
  await expect(page.getByRole("heading", { name: "Mandantenaufnahme E2E" })).toBeVisible();

  // Keine horizontale Scrollleiste
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByText("Unternehmen", { exact: true }).tap();
  await page.getByRole("button", { name: "OK" }).tap();
  await page.getByLabel("Firmenname").fill("Muster GmbH");
  await page.getByRole("button", { name: "OK" }).tap();
  await page.getByLabel("Ihr Name").fill("Max Muster");
  await page.getByRole("button", { name: "OK" }).tap();
  // Pflichtfeld leer → Fehler auf der Karte
  await page.getByRole("button", { name: "OK" }).tap();
  await expect(page.locator("[data-field] [role=alert], form [role=alert]").first()).toBeVisible();
  await page.getByLabel("E-Mail").fill("max@muster.de");
  await page.getByRole("button", { name: "OK" }).tap();
  await page.getByLabel(/Worum geht es, Max Muster/).fill("Vertragsprüfung");
  await page.getByRole("button", { name: "OK" }).tap();
  await humanPause(page);
  await page.getByRole("button", { name: "Absenden" }).tap();
  await expect(page.getByRole("status")).toContainText("Vielen Dank");

  const rows = await submissionsOf(formId);
  expect(rows).toHaveLength(1);
  expect(rows[0].data).toMatchObject({ kind: "Unternehmen", company: "Muster GmbH", email: "max@muster.de" });
});
