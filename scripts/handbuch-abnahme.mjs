// Abnahme: spielt den Ablauf aus docs/handbuch/00-erste-schritte.md nach und erzeugt die Handbuchbilder.
//   pnpm docs:abnahme <baseUrl> <Einrichtungscode>   (Anleitung: docs/handbuch/27-tests.md)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const [, , base, code] = process.argv;
if (!base || !code) { console.error("Aufruf: pnpm docs:abnahme <baseUrl> <Einrichtungscode>"); process.exit(2); }
const IMG = "docs/bilder/", TMP = ".scratch/handbuch-abnahme/";
mkdirSync(IMG, { recursive: true }); mkdirSync(TMP, { recursive: true });
const results = [];
const check = (name, ok, info = "") => { results.push([ok ? "OK  " : "FAIL", name, info]); console.log(ok ? "✓" : "✗", name, info); };
const b = await chromium.launch({ args: ["--lang=de-DE"] });
const VIEW = { width: 1280, height: 800 };
async function ctxFor(state, theme = "light") {
  const c = await b.newContext({ viewport: VIEW, deviceScaleFactor: 2, locale: "de-DE", timezoneId: "Europe/Berlin", acceptDownloads: true, ...(state ? { storageState: state } : {}) });
  await c.addInitScript((t) => { try { localStorage.setItem("plica-theme", t); } catch {} }, theme);
  return c;
}
async function shot(p, name, opts = {}) {
  await p.waitForTimeout(500);
  const raw = TMP + name;
  if (opts.locator) {
    const bb = await opts.locator.boundingBox(); const m = 32;
    await p.screenshot({ path: raw, clip: { x: Math.max(0, bb.x - m), y: Math.max(0, bb.y - m), width: Math.min(VIEW.width, bb.width + 2 * m), height: Math.min(VIEW.height, bb.height + 2 * m) } });
  } else await p.screenshot({ path: raw });
  // nur verkleinern, nie vergrößern (Dialog-Ausschnitte bleiben scharf)
  const w = Number(/pixelWidth: (\d+)/.exec(execFileSync("sips", ["-g", "pixelWidth", raw]).toString())[1]);
  execFileSync("sips", ...(w > 1600 ? [["--resampleWidth", "1600", raw, "--out", IMG + name]] : [["-s", "format", "png", raw, "--out", IMG + name]]), { stdio: "ignore" });
}
const errs = (p) => p.on("pageerror", (e) => check("keine Seitenfehler", false, e.message));

// ── 1. Ersteinrichtung (Anna, Inhaberin) ───────────────────────────────
const ca = await ctxFor(); const a = await ca.newPage(); errs(a);
await a.goto(base + "/"); await a.waitForURL(/einrichten/);
check("Start leitet auf /einrichten", a.url().includes("/einrichten"));
await a.fill("#code", code);
await shot(a, "einrichten-code.png");
await a.click("button[type=submit]");
await a.fill("#name", "Dr. Anna Beispiel"); await a.fill("#email", "anna.beispiel@example.de"); await a.fill("#password", "Musterpasswort-2026!");
await a.click("button[type=submit]");
await a.fill("#workspace", "Kanzlei Musterstadt");
await a.getByRole("button", { name: "Einrichtung abschließen" }).click();
await a.waitForURL(/willkommen/, { timeout: 20000 });
const h1 = await a.locator("h1").innerText();
check("Willkommensseite begrüßt ohne Titel", h1 === "Willkommen, Anna.", h1);
await shot(a, "willkommen.png");

// ── 2. ReFa einladen ───────────────────────────────────────────────────
await a.goto(base + "/einstellungen/team"); await a.waitForTimeout(800);
await a.getByLabel("E-Mail-Adresse").fill("lena.muster@example.de");
await a.getByRole("button", { name: "Einladen" }).click();
const link = await a.getByLabel("Einladungslink").inputValue();
check("Einladungslink angezeigt", /\/einladung\//.test(link));
await shot(a, "team-einladen.png");

const cl = await ctxFor(); const l = await cl.newPage(); errs(l);
await l.goto(link); await l.waitForTimeout(600);
await l.fill("#inv-name", "Lena Muster"); await l.fill("#inv-pw", "ReFa-Passwort-2026!");
await l.getByRole("button", { name: "Konto anlegen und beitreten" }).click();
await l.waitForURL((u) => !u.pathname.startsWith("/einladung"), { timeout: 20000 });
await l.waitForTimeout(800);
check("Lena ist Bearbeiter", (await l.locator("body").innerText()).includes("Bearbeiter"));

// ── 3. Teil A: Formular bereitstellen (Lena) ───────────────────────────
await l.goto(base + "/vorlagen"); await l.waitForTimeout(800);
await l.getByText("Mandantenaufnahme", { exact: true }).first().click(); await l.waitForTimeout(800);
await shot(l, "vorlage-mandantenaufnahme.png");
await l.getByRole("button", { name: "Vorlage verwenden" }).click();
await l.waitForURL(/bearbeiten/, { timeout: 20000 }); await l.waitForTimeout(1500);
const F = l.url().split("/formulare/")[1].split("/")[0];
await l.getByRole("button", { name: "Veröffentlichen", exact: true }).click();
const dlg = l.getByRole("dialog"); await dlg.waitFor();
check("Dialog „Dein Formular ist online“", (await dlg.innerText()).includes("Dein Formular ist online"));
await shot(l, "veroeffentlicht.png", { locator: dlg });
await l.keyboard.press("Escape");

// ── 4. Teil B: Mandantinnen füllen aus ─────────────────────────────────
writeFileSync(TMP + "Kuendigung-Muster-Logistik.pdf", "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
const people = [
  { art: "Privatperson", first: "Erika", last: "Mustermann", email: "erika.mustermann@example.de", tel: "0151 23456789", str: "Beispielweg 12", plz: "12345", ort: "Musterstadt", gebiet: "Arbeitsrecht", gegner: "Muster Logistik GmbH", text: "Ich bin seit 2019 als Lageristin beschäftigt. Am 17.11.2026 habe ich die schriftliche Kündigung zum 31.01.2027 erhalten, ohne Abmahnung vorher.", ziel: "Ich möchte meinen Arbeitsplatz behalten, notfalls eine Abfindung.", frist: "2026-12-08", betrag: "9600", upload: true, mail: true },
  { art: "Privatperson", first: "Jonas", last: "Beispiel", email: "jonas.beispiel@example.de", tel: "0170 1111111", str: "Hauptstraße 3", plz: "12345", ort: "Musterstadt", gebiet: "Mietrecht", gegner: "Hausverwaltung Platzhalter KG", text: "Die Nebenkostenabrechnung 2025 enthält Posten, die im Mietvertrag nicht vereinbart sind, und ist deutlich höher als im Vorjahr.", betrag: "840" },
  { art: "Unternehmen oder Organisation", firma: "Beispiel Bau GmbH", first: "Paul", last: "Platzhalter", email: "p.platzhalter@example.de", tel: "030 1234567", str: "Gewerbering 7", plz: "12347", ort: "Musterstadt", gebiet: "Zivilrecht / Vertragsrecht", gegner: "Test Immobilien AG", text: "Unser Auftraggeber zahlt die Schlussrechnung über ein Bauvorhaben nicht und beruft sich auf angebliche Mängel, die nie angezeigt wurden.", betrag: "48500" },
  { art: "Privatperson", first: "Mia", last: "Probe", email: "mia.probe@example.de", tel: "0160 2222222", str: "Am Markt 1", plz: "12345", ort: "Musterstadt", gebiet: "Verwaltungsrecht", gegner: "Stadt Musterstadt", text: "Mein Antrag auf Baugenehmigung für einen Carport wurde abgelehnt. Der Bescheid kam am 12.11.2026 per Post.", frist: "2026-12-12" },
];
for (const [i, m] of people.entries()) {
  const cm = await ctxFor(); const p = await cm.newPage(); errs(p);
  await p.goto(base + "/f/mandantenaufnahme"); await p.waitForTimeout(800);
  await p.getByText(m.art, { exact: true }).click();
  if (m.firma) await p.getByRole("textbox", { name: "Name des Unternehmens" }).fill(m.firma);
  await p.getByLabel("Vorname", { exact: true }).fill(m.first); await p.getByLabel("Nachname", { exact: true }).fill(m.last);
  await p.getByRole("textbox", { name: "E-Mail" }).fill(m.email); await p.getByRole("textbox", { name: "Telefon" }).fill(m.tel);
  await p.getByLabel("Straße und Hausnummer", { exact: true }).fill(m.str); await p.getByLabel("PLZ", { exact: true }).fill(m.plz); await p.getByLabel("Ort", { exact: true }).fill(m.ort);
  await p.getByRole("button", { name: "Weiter" }).click(); await p.waitForTimeout(500);
  await p.getByRole("combobox", { name: "Rechtsgebiet" }).selectOption(m.gebiet);
  await p.getByRole("textbox", { name: "Gegenseite" }).fill(m.gegner);
  await p.getByRole("textbox", { name: "Was ist passiert?" }).fill(m.text);
  if (m.ziel) await p.getByLabel("Was möchten Sie erreichen?", { exact: true }).fill(m.ziel);
  await p.getByRole("radiogroup", { name: /Läuft eine Frist/ }).getByText(m.frist ? "Ja" : "Nein", { exact: true }).click();
  if (m.frist) { await p.waitForTimeout(500); await p.getByLabel("Wann endet die Frist?").fill(m.frist); }
  if (m.betrag) await p.getByLabel("Um welchen Betrag geht es ungefähr?", { exact: true }).fill(m.betrag);
  await p.getByRole("radiogroup", { name: /Rechtsschutzversicherung/ }).getByText("Nein", { exact: true }).click();
  if (i === 0) {
    await p.evaluate(() => (document.activeElement)?.blur());
    await p.getByRole("textbox", { name: "Was ist passiert?" }).evaluate((e) => e.scrollIntoView({ block: "start" }));
    await p.evaluate(() => window.scrollBy(0, -40)); await p.waitForTimeout(900);
    await shot(p, "formular-anliegen.png");
  }
  await p.getByRole("button", { name: "Weiter" }).click(); await p.waitForTimeout(500);
  if (m.upload) { await p.setInputFiles("input[type=file]", TMP + "Kuendigung-Muster-Logistik.pdf"); await p.getByText("Kuendigung-Muster-Logistik.pdf").waitFor(); }
  await p.getByRole("button", { name: "Weiter" }).click(); await p.waitForTimeout(500);
  await p.getByText("Ich willige ein").click();
  if (m.mail) await p.getByText("Die Kanzlei darf mit mir").click();
  await p.getByRole("button", { name: "Weiter" }).click(); await p.waitForTimeout(2700);
  await p.getByRole("button", { name: "Anfrage verbindlich senden" }).click();
  const st = p.getByRole("status"); await st.waitFor({ timeout: 15000 });
  const end = await st.innerText();
  if (m.frist) check(`Abschluss eilig (${m.last})`, end.includes("wir melden uns umgehend") && end.includes(m.frist.split("-").reverse().join(".")), end.split("\n")[0]);
  else check(`Abschluss normal (${m.last})`, end.startsWith("Ihre Anfrage ist eingegangen") && !end.includes("umgehend"));
  if (i === 0) { await p.waitForTimeout(600); await shot(p, "formular-abschluss.png", { locator: st }); }
  await cm.close();
}

// ── 5. Anfrage bearbeiten (Lena) ───────────────────────────────────────
await l.goto(`${base}/formulare/${F}/antworten`); await l.waitForTimeout(1200);
const head = await l.locator("thead").innerText();
check("Standardspalten enthalten Ihr Name und E-Mail", /Ihr Name/.test(head) && /E-Mail/.test(head), head.replace(/\s+/g, " "));
check("4 Antworten, alle Neu", (await l.getByRole("button", { name: /Neu\s*4/ }).count()) > 0);
await l.getByRole("button", { name: "Spalten" }).click(); await l.waitForTimeout(300);
const pop = l.getByRole("dialog");
for (const n of ["E-Mail", "Sie wenden sich an uns als", "Name des Unternehmens", "Rechtsgebiet", "Wann endet die Frist?"]) await pop.getByText(n, { exact: true }).click();
await l.keyboard.press("Escape"); await l.waitForTimeout(300);
await l.getByRole("row").filter({ hasText: "Erika Mustermann" }).click(); await l.waitForURL(/antworten\/.+/); await l.waitForTimeout(1200);
await l.getByRole("button", { name: /^Status: Neu/ }).click();
await l.getByRole("menuitem", { name: /In Prüfung/ }).click(); await l.waitForTimeout(700);
await l.getByLabel("Tag hinzufügen").fill("Frist"); await l.keyboard.press("Enter"); await l.waitForTimeout(700);
await l.getByLabel("Neue Notiz").fill("Frist 08.12.2026 (Klagefrist § 4 KSchG) im Fristenkalender notiert. Rückruf mit Frau Mustermann am 21.11., 10 Uhr.");
await l.getByRole("button", { name: "Notiz speichern" }).click(); await l.waitForTimeout(900);
check("Datei in Quarantäne", (await l.locator("main").innerText()).includes("Quarantäne – nicht auf Viren geprüft"));
await l.getByRole("button", { name: /Ungeprüft freigeben/ }).click();
const fd = l.getByRole("dialog"); await fd.waitFor();
await shot(l, "datei-freigeben.png", { locator: fd });
await fd.getByRole("button", { name: "Trotzdem freigeben" }).click(); await l.waitForTimeout(1000);
await l.reload(); await l.waitForTimeout(1500);
await l.evaluate(() => window.scrollTo(0, 0)); await l.waitForTimeout(300);
const detail = await l.locator("main").innerText();
for (const t of ["Status: Neu → In Prüfung", "Tags +Frist", "ohne Virenprüfung freigegeben", "Klagefrist § 4 KSchG"]) check(`Verlauf/Detail enthält „${t}“`, detail.includes(t));
await shot(l, "antwort-bearbeitet.png");
// Tabelle
await l.goto(`${base}/formulare/${F}/antworten`); await l.waitForTimeout(1200);
const tbl = await l.locator("table").innerText();
check("Tabelle zeigt Fristende 08.12.2026", tbl.includes("08.12.2026"));
await shot(l, "antworten-tabelle.png");
// PDF
await l.getByRole("row").filter({ hasText: "Erika Mustermann" }).click(); await l.waitForTimeout(1200);
await l.getByRole("button", { name: "Weitere Aktionen" }).click();
const [dl] = await Promise.all([l.waitForEvent("download"), l.getByRole("menuitem", { name: /PDF herunterladen/ }).click()]);
const pdf = TMP + dl.suggestedFilename(); await dl.saveAs(pdf);
check("PDF-Dateiname", dl.suggestedFilename() === "mandantenaufnahme-antwort-1.pdf", dl.suggestedFilename());
const pdfText = execFileSync("pdftotext", ["-layout", pdf, "-"]).toString();
check("PDF enthält Status, Name und Fristende", /In Prüfung/.test(pdfText) && pdfText.includes("Erika Mustermann") && pdfText.includes("08.12.2026"));
execFileSync("pdftoppm", ["-png", "-r", "100", "-f", "1", "-l", "1", "-singlefile", pdf, IMG + "pdf-ergebnis"]);

// ── 6. Anwältin prüft, ReFa schließt ab; KI-Funktion (Anna) ────────────
await a.goto(l.url()); await a.waitForTimeout(1200);
await a.getByLabel("Neue Notiz").fill("Kollisionsprüfung ohne Treffer, Mandat angenommen. Akte bitte anlegen.");
await a.getByRole("button", { name: "Notiz speichern" }).click(); await a.waitForTimeout(800);
await l.reload(); await l.waitForTimeout(1200);
await l.getByRole("button", { name: /^Status: In Prüfung/ }).click();
await l.getByRole("menuitem", { name: /Erledigt/ }).click(); await l.waitForTimeout(900);
check("Status Erledigt im Verlauf", (await l.locator("main").innerText()).includes("In Prüfung → Erledigt"));

await a.goto(base + "/vorlagen"); await a.waitForTimeout(800);
await a.getByRole("button", { name: /Aus Beschreibung/ }).first().click();
await a.getByRole("dialog").locator("textarea").fill("Fragebogen zur Vorbereitung eines Erbscheinsantrags: Erblasser mit Sterbedatum und letztem Wohnsitz, Antragsteller mit Kontaktdaten, Verwandtschaftsverhältnis, gibt es ein Testament (ja/nein), Upload der Sterbeurkunde, Einwilligung Datenschutz.");
await a.getByRole("button", { name: /Entwurf erzeugen/ }).click(); await a.waitForTimeout(2000);
const gen = await a.getByRole("dialog").innerText();
check("Entwurf ohne KI erzeugt", gen.includes("Erzeugt mit dem eingebauten Generator"));
check("Keine leeren Klammern in Beschriftungen", !gen.includes("()"));
await shot(a, "aus-beschreibung.png", { locator: a.getByRole("dialog") });

// Ausschnitte für das README (Koordinaten passen zu 1280 × 800, Faktor 2, verkleinert auf 1600)
for (const [src, h, w, y, x, name] of [["formular-anliegen", 450, 840, 495, 380, "readme-formular"], ["antworten-tabelle", 335, 1240, 212, 325, "readme-tabelle"], ["pdf-ergebnis", 420, 770, 50, 30, "readme-pdf"]])
  execFileSync("sips", ["-c", String(h), String(w), "--cropOffset", String(y), String(x), IMG + src + ".png", "--out", IMG + name + ".png"], { stdio: "ignore" });

await b.close();
console.log("\n" + results.map((r) => r.join("  ")).join("\n"));
const fails = results.filter((r) => r[0] !== "OK  ").length;
console.log(`\n${results.length - fails}/${results.length} Prüfungen bestanden.`);
process.exit(fails ? 1 : 0);
