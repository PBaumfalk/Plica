// node scripts/lifecycle/flow.mjs <baseUrl> <setupCode> <phase: setup|submit|check>
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [,, base, code, phase] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ locale: "de-DE" });
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
if (phase === "setup") {
  await p.goto(base + "/");
  await p.waitForURL(/einrichten/);
  await p.fill("#code", code);
  await p.click("button[type=submit]");
  await p.fill("#name", "Betrieb Test");
  await p.fill("#email", "betrieb@plica.test");
  await p.fill("#password", "Ein langes Testpasswort 2026");
  await p.click("button[type=submit]");
  await p.fill("#workspace", "Kanzlei Prod-Test");
  await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.includes("einrichten"), { timeout: 20000 });
  console.log("setup ok ->", p.url());
}
if (phase === "submit") {
  writeFileSync(process.env.TMPDIR_PLICA + "/plica-vollmacht.pdf", "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  await p.goto(base + "/f/kontakt");
  await p.fill("#q-name", "Erika Mustermann");
  await p.fill("#q-email", "erika@example.de");
  await p.fill("#q-msg", "Bitte um Rückruf wegen Kündigung.");
  await p.setInputFiles('input[type=file]', process.env.TMPDIR_PLICA + "/plica-vollmacht.pdf");
  await p.getByText("plica-vollmacht.pdf").waitFor();
  await p.waitForTimeout(2600); // Mindest-Ausfüllzeit (Spam-Schutz)
  await p.getByRole("button", { name: "Absenden" }).click();
  await p.getByRole("status").waitFor({ timeout: 15000 });
  console.log("submit ok:", (await p.getByRole("status").innerText()).split("\n")[0]);
}
await b.close();
