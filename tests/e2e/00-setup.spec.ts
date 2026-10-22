// Ablauf 1: Administrator richtet PLICA erstmalig ein.
import { expect, test } from "@playwright/test";
import { OWNER, SETUP_CODE } from "./helpers";

test("Ersteinrichtung mit Einrichtungscode", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/einrichten$/);
  await expect(page.getByRole("heading", { name: "PLICA einrichten" })).toBeVisible();

  await page.getByLabel("Einrichtungscode").fill("0000-0000-0000");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Code stimmt nicht" })).toBeVisible();

  await page.getByLabel("Einrichtungscode").fill(SETUP_CODE);
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel("Name").fill(OWNER.name);
  await page.getByLabel("E-Mail").fill(OWNER.email);
  await page.getByLabel("Passwort").fill(OWNER.password);
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByLabel("Name des Workspace").fill(OWNER.workspace);
  await page.getByRole("button", { name: "Einrichtung abschließen" }).click();
  await expect(page).toHaveURL(/\/willkommen/);

  // Einrichtung ist danach gesperrt
  await page.goto("/einrichten");
  await expect(page).not.toHaveURL(/\/einrichten$/);

  await page.context().storageState({ path: "test-results/.auth/owner.json" });
});
