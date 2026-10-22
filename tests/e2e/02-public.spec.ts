// Abläufe 7, 9, 10, 11, 16: öffentlicher Link, Upload, Fehler, Speicherung, stabile Version.
import { expect, test } from "@playwright/test";
import { humanPause, intakeDefinition, PDF_BYTES, seedPublishedForm, sql, submissionsOf } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } }); // externer, nicht angemeldeter Nutzer

test("Externer Nutzer füllt den Wizard aus – mit Logik, Upload und Fehlern", async ({ page }) => {
  const { formId } = await seedPublishedForm("aufnahme-wizard", intakeDefinition("wizard"));
  await page.goto("/f/aufnahme-wizard");
  await expect(page.getByRole("heading", { name: "Mandantenaufnahme E2E" })).toBeVisible();

  // Pflichtfelder fehlen → verständliche Fehler, kein Weiterkommen
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.locator("[data-field] [role=alert], form [role=alert]").first()).toBeVisible();
  await expect(page.getByText("Bitte auswählen.")).toBeVisible();

  // Bedingte Logik: Firmenname nur für Unternehmen
  await expect(page.getByLabel("Firmenname")).toHaveCount(0);
  await page.getByText("Unternehmen", { exact: true }).click();
  await expect(page.getByLabel("Firmenname")).toBeVisible();
  await page.getByText("Privatperson", { exact: true }).click();
  await expect(page.getByLabel("Firmenname")).toHaveCount(0);

  await page.getByLabel("Ihr Name").fill("Erika Mustermann");
  await page.getByLabel("E-Mail").fill("keine-adresse");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(/gültige E-Mail-Adresse/)).toBeVisible();
  await page.getByLabel("E-Mail").fill("erika@example.de");
  await page.getByRole("button", { name: "Weiter" }).click();

  // Personalisierung mit vorheriger Antwort
  await expect(page.getByText("Worum geht es, Erika Mustermann?")).toBeVisible();
  await page.getByLabel(/Worum geht es/).fill("Kündigung zum Monatsende, Frist läuft.");

  // Unerlaubter Dateityp wird abgelehnt, erlaubter angenommen
  await page.locator("input[type=file]").setInputFiles({ name: "trick.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html><script>alert(1)</script></html>") });
  await expect(page.getByText(/nicht erlaubt/)).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({ name: "kuendigung.pdf", mimeType: "application/pdf", buffer: PDF_BYTES });
  await expect(page.getByText("kuendigung.pdf")).toBeVisible();

  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Alles richtig?" })).toBeVisible();
  await expect(page.getByText("erika@example.de")).toBeVisible();
  await humanPause(page);
  await page.getByRole("button", { name: "Absenden" }).click();
  await expect(page.getByRole("status")).toContainText("Vielen Dank");

  const rows = await submissionsOf(formId);
  expect(rows).toHaveLength(1);
  expect(rows[0].data).toMatchObject({ kind: "Privatperson", name: "Erika Mustermann", email: "erika@example.de" });
  expect(rows[0].data.company).toBeUndefined();
  const [file] = await sql()`select name, mime, submission_id from files where submission_id = ${rows[0].id}`;
  expect(file).toMatchObject({ name: "kuendigung.pdf", mime: "application/pdf" });
});

test("Veröffentlichte Version bleibt stabil, während ein Entwurf bearbeitet wird", async ({ page }) => {
  const { formId } = await seedPublishedForm("stabile-version", intakeDefinition("classic"));
  // Entwurf ändern: Titel und neues Pflichtfeld – nicht veröffentlichen
  const [{ draft }] = await sql()`select draft from forms where id = ${formId}`;
  draft.title = "ENTWURF – noch nicht live";
  await sql()`update forms set draft = ${sql().json(draft)}, draft_revision = draft_revision + 1 where id = ${formId}`;

  await page.goto("/f/stabile-version");
  await expect(page.getByRole("heading", { name: "Mandantenaufnahme E2E" })).toBeVisible();
  await expect(page.getByText("ENTWURF")).toHaveCount(0);
});

test("Geschlossene und unbekannte Formulare", async ({ page }) => {
  const { formId } = await seedPublishedForm("pausiert", intakeDefinition());
  await sql()`update forms set status = 'paused' where id = ${formId}`;
  await page.goto("/f/pausiert");
  await expect(page.getByText(/vorübergehend keine Antworten/)).toBeVisible();
  const r = await page.goto("/f/gibt-es-nicht");
  expect(r?.status()).toBe(404);
});
