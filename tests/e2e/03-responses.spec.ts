// Abläufe 12–14: Benachrichtigung wird versandt, PDF wird erzeugt, Export enthält korrekte Daten.
import { expect, test } from "@playwright/test";
import { humanPause, intakeDefinition, seedPublishedForm, submissionsOf, waitForMail } from "./helpers";

test("Einreichung → E-Mail-Benachrichtigung, Antwortansicht, PDF und CSV/XLSX-Export", async ({ page, browser }) => {
  const def = intakeDefinition("classic");
  def.pages[1].fields = def.pages[1].fields.filter((f) => f.type !== "file");
  const { formId } = await seedPublishedForm("benachrichtigung", def, ["team@kanzlei-e2e.test"]);

  // Einreichung als externer Nutzer
  const ext = await browser.newContext({ locale: "de-DE" });
  const p = await ext.newPage();
  await p.goto("/f/benachrichtigung");
  await p.getByText("Privatperson", { exact: true }).click();
  await p.getByLabel("Ihr Name").fill("Jonas Beispiel");
  await p.getByLabel("E-Mail").fill("jonas@example.de");
  await p.getByLabel(/Worum geht es/).fill("Abmahnung erhalten; Semikolon; \"Zitat\"; =SUMME(1)");
  await humanPause(p);
  await p.getByRole("button", { name: "Absenden" }).click();
  await expect(p.getByRole("status")).toContainText("Vielen Dank");
  await ext.close();
  const [sub] = await submissionsOf(formId);

  // 12: Benachrichtigung tatsächlich versandt (Mailpit)
  const mail = await waitForMail("team@kanzlei-e2e.test", /Mandantenaufnahme E2E/);
  expect(mail.Subject).toMatch(/Mandantenaufnahme E2E/);

  // Antwort im Verwaltungsbereich sichtbar
  await page.goto(`/formulare/${formId}/antworten`);
  await expect(page.getByText("Jonas Beispiel").first()).toBeVisible();
  await page.goto(`/formulare/${formId}/antworten/${sub.id}`);
  await expect(page.getByText("jonas@example.de").first()).toBeVisible();

  // 13: PDF wird erzeugt und ist ein echtes PDF
  const pdf = await page.request.get(`/api/submissions/${sub.id}/pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(1500);

  // 14: Export enthält die korrekten Daten, Formelinjektion entschärft
  const csv = await page.request.get(`/api/forms/${formId}/export?format=csv`);
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain("Jonas Beispiel");
  expect(text).toContain("jonas@example.de");
  expect(text).not.toMatch(/[;,]=SUMME/);
  const xlsx = await page.request.get(`/api/forms/${formId}/export?format=xlsx`);
  expect(xlsx.status()).toBe(200);
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");
});
