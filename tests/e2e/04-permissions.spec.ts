// Ablauf 15: Ein nicht berechtigter Benutzer kann die Antwort nicht sehen.
import { expect, test } from "@playwright/test";
import { hash } from "@node-rs/argon2";
import { humanPause, intakeDefinition, login, seedPublishedForm, sql, submissionsOf } from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("Fremder Workspace und Leser sehen bzw. ändern keine fremden Antworten", async ({ page, browser }) => {
  const def = intakeDefinition("classic");
  def.pages[1].fields = def.pages[1].fields.filter((f) => f.type !== "file");
  const { formId, workspaceId } = await seedPublishedForm("vertraulich", def);
  const ext = await browser.newPage();
  await ext.goto("/f/vertraulich");
  await ext.getByText("Privatperson", { exact: true }).click();
  await ext.getByLabel("Ihr Name").fill("Vertrauliche Person");
  await ext.getByLabel("E-Mail").fill("geheim@example.de");
  await ext.getByLabel(/Worum geht es/).fill("Strafsache");
  await humanPause(ext);
  await ext.getByRole("button", { name: "Absenden" }).click();
  await expect(ext.getByRole("status")).toBeVisible();
  const [sub] = await submissionsOf(formId);

  // Fremder Workspace
  const pw = "Fremdes Konto Passwort 2026";
  const db = sql();
  const [ws] = await db`insert into workspaces (name, webhook_secret) values ('Fremde Kanzlei', 'v1.x.x.x') returning id`;
  const [u] = await db`insert into users (email, name, password_hash) values ('fremd@plica.test', 'Fremd', ${await hash(pw, { algorithm: 2 })}) returning id`;
  await db`insert into memberships (workspace_id, user_id, role) values (${ws.id}, ${u.id}, 'owner')`;
  await login(page, "fremd@plica.test", pw);
  for (const path of [`/formulare/${formId}/antworten`, `/formulare/${formId}/antworten/${sub.id}`, `/formulare/${formId}/bearbeiten`]) {
    await page.goto(path);
    await expect(page.getByText("Vertrauliche Person")).toHaveCount(0);
    await expect(page.getByText("geheim@example.de")).toHaveCount(0);
  }
  for (const api of [`/api/submissions/${sub.id}/pdf`, `/api/forms/${formId}/export?format=csv`]) {
    const r = await page.request.get(api);
    expect([403, 404]).toContain(r.status());
  }

  // Leser im eigenen Workspace: sehen ja, exportieren nein
  const [r] = await db`insert into users (email, name, password_hash) values ('leser@plica.test', 'Leser', ${await hash(pw, { algorithm: 2 })}) returning id`;
  await db`insert into memberships (workspace_id, user_id, role) values (${workspaceId}, ${r.id}, 'viewer')`;
  await page.context().clearCookies();
  await login(page, "leser@plica.test", pw);
  await page.goto(`/formulare/${formId}/antworten`);
  await expect(page.getByText("Vertrauliche Person").first()).toBeVisible();
  expect((await page.request.get(`/api/forms/${formId}/export?format=csv`)).status()).toBe(403);

  // Ohne Anmeldung
  await page.context().clearCookies();
  expect([401, 403]).toContain((await page.request.get(`/api/submissions/${sub.id}/pdf`)).status());
  await page.goto(`/formulare/${formId}/antworten`);
  await expect(page).toHaveURL(/\/login/);
});
