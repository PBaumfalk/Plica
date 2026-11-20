// Allgemeine README-Bilder (Kundenanfrage statt Kanzlei-Beispiel).
//   pnpm docs:readme-bilder <baseUrl> <Einrichtungscode>   (frische, nicht eingerichtete Instanz)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const [, , base, code] = process.argv;
if (!base || !code) { console.error("Aufruf: pnpm docs:readme-bilder <baseUrl> <Einrichtungscode>"); process.exit(2); }
const IMG = "docs/bilder/", TMP = ".scratch/readme-bilder/";
mkdirSync(TMP, { recursive: true });
const VIEW = { width: 1280, height: 800 };
const b = await chromium.launch({ args: ["--lang=de-DE"] });
const ctx = async (state, view = VIEW) => {
  const c = await b.newContext({ viewport: view, deviceScaleFactor: 2, locale: "de-DE", timezoneId: "Europe/Berlin", ...(state ? { storageState: state } : {}) });
  await c.addInitScript(() => { try { localStorage.setItem("plica-theme", "light"); } catch {} });
  return c;
};
async function shot(p, name, clip) {
  await p.waitForTimeout(600);
  const raw = TMP + name;
  await p.screenshot({ path: raw, ...(clip ? { clip } : {}) });
  const w = Number(/pixelWidth: (\d+)/.exec(execFileSync("sips", ["-g", "pixelWidth", raw]).toString())[1]);
  execFileSync("sips", w > 1600 ? ["--resampleWidth", "1600", raw, "--out", IMG + name] : ["-s", "format", "png", raw, "--out", IMG + name], { stdio: "ignore" });
  console.log("Bild:", name);
}

// Einrichtung
const ca = await ctx(); const a = await ca.newPage();
a.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await a.goto(base + "/"); await a.waitForURL(/einrichten/);
await a.fill("#code", code); await a.click("button[type=submit]");
await a.fill("#name", "Alex Beispiel"); await a.fill("#email", "alex@example.com"); await a.fill("#password", "Musterpasswort-2026!");
await a.click("button[type=submit]");
await a.fill("#workspace", "Beispiel GmbH");
await a.getByRole("button", { name: "Einrichtung abschließen" }).click();
await a.waitForURL(/willkommen/);

// Vorlagen-Galerie mit Kundenanfrage
await a.goto(base + "/vorlagen"); await a.waitForTimeout(800);
await a.getByText("Kundenanfrage", { exact: true }).first().click(); await a.waitForTimeout(900);
await shot(a, "readme-vorlagen.png");
await a.getByRole("button", { name: "Vorlage verwenden" }).click();
await a.waitForURL(/bearbeiten/); await a.waitForTimeout(1500);
const F = a.url().split("/formulare/")[1].split("/")[0];
await a.getByText("Wofür interessieren Sie sich?").first().click(); await a.waitForTimeout(800);
await a.locator("[data-sonner-toast]").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {}); await a.waitForTimeout(500);
await shot(a, "readme-editor.png");
await a.getByRole("button", { name: "Veröffentlichen", exact: true }).click();
await a.getByRole("dialog").waitFor(); await a.keyboard.press("Escape");

// Anfragen
const leads = [
  ["Nordlicht Logistik GmbH", "Jana", "Beispiel", "jana@nordlicht.example", ["Angebot für ein Projekt", "Schulung"], "18000", "In den nächsten 3 Monaten", "Wir möchten unsere Tourenplanung digitalisieren und suchen Unterstützung bei Auswahl und Einführung.", "newsletter"],
  ["Gartenbau Grün & Co. KG", "Tim", "Muster", "tim@gruen.example", ["Beratung"], "3500", "So schnell wie möglich", "Unsere Website soll Terminanfragen direkt entgegennehmen. Was wäre der beste Weg?", "website"],
  ["Praxis am Park", "Dr. Sara", "Probe", "praxis@park.example", ["Wartung und Betreuung"], "", "In diesem Jahr", "Wir suchen eine dauerhafte Betreuung für unsere IT mit festen Ansprechpartnern.", "messe"],
  ["Verein Sportfreunde e. V.", "Ole", "Test", "vorstand@sportfreunde.example", ["Beratung", "Schulung"], "1200", "Noch offen", "Mitgliedsanträge und Kursanmeldungen sollen online laufen statt auf Papier.", "website"],
  ["Stadtwerke Musterstadt", "Lea", "Platzhalter", "l.platzhalter@stadtwerke.example", ["Angebot für ein Projekt"], "45000", "In diesem Jahr", "Für ein Kundenportal benötigen wir Formulare mit Datei-Upload und Freigabeprozess.", "newsletter"],
];
for (const [i, [firma, vor, nach, mail, interessen, budget, zeit, text, quelle]] of leads.entries()) {
  const cm = await ctx(); const p = await cm.newPage();
  await p.goto(`${base}/f/kundenanfrage?quelle=${quelle}`); await p.waitForTimeout(800);
  await p.getByRole("textbox", { name: "Unternehmen" }).fill(firma);
  await p.getByLabel("Vorname", { exact: true }).fill(vor); await p.getByLabel("Nachname", { exact: true }).fill(nach);
  await p.getByRole("textbox", { name: "E-Mail" }).fill(mail);
  for (const x of interessen) await p.getByText(x, { exact: true }).click();
  if (budget) await p.getByLabel("Budgetrahmen", { exact: true }).fill(budget);
  await p.getByRole("combobox", { name: "Zeitrahmen" }).selectOption(zeit);
  await p.getByRole("textbox", { name: "Beschreiben Sie Ihr Vorhaben" }).fill(text);
  await p.getByText("Ich bin damit einverstanden").click();
  if (i === 0) {
    await p.evaluate(() => document.activeElement?.blur());
    await p.getByText("Wofür interessieren Sie sich?").first().evaluate((e) => e.scrollIntoView({ block: "start" }));
    await p.evaluate(() => window.scrollBy(0, -150));
    await shot(p, "readme-formular.png");
  }
  await p.waitForTimeout(2700);
  await p.getByRole("button", { name: "Anfrage senden" }).click();
  await p.getByRole("status").waitFor({ timeout: 15000 });
  await cm.close();
}

// Antworten: Spalten wählen, zwei Status setzen
await a.goto(`${base}/formulare/${F}/antworten`); await a.waitForTimeout(1200);
console.log("Spalten:", (await a.locator("thead").innerText()).replace(/\s+/g, " "));
await a.getByRole("button", { name: "Spalten" }).click(); await a.waitForTimeout(300);
const pop = a.getByRole("dialog");
for (const n of ["E-Mail", "Telefon", "Wofür interessieren Sie sich?", "Budgetrahmen", "Quelle"]) {
  const box = pop.getByRole("checkbox", { name: n }).or(pop.getByText(n, { exact: true }));
  await box.first().click();
}
await a.keyboard.press("Escape"); await a.waitForTimeout(300);
for (const [who, st] of [["Nordlicht", "In Prüfung"], ["Gartenbau", "Erledigt"]]) {
  await a.getByRole("row").filter({ hasText: who }).click(); await a.waitForTimeout(1000);
  await a.getByRole("button", { name: /^Status: / }).click();
  await a.getByRole("menuitem", { name: new RegExp(st) }).click(); await a.waitForTimeout(600);
  await a.goto(`${base}/formulare/${F}/antworten`); await a.waitForTimeout(1000);
}
console.log("Spalten jetzt:", (await a.locator("thead").innerText()).replace(/\s+/g, " "));
await shot(a, "readme-antworten.png");
// Automationen und Auswertung
await a.goto(`${base}/formulare/${F}/auswertung`); await a.waitForTimeout(1500);
await shot(a, "readme-auswertung.png");
await b.close();
