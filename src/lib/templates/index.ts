/**
 * Mitgelieferte Vorlagen. Alle laufen mit der echten Formular-Engine
 * (Logik, Berechnungen, Uploads, Unterschrift) und sind frei editierbar.
 */
import type { FormDefinition } from "@/lib/forms/schema";
import { build, Kit, PRIVACY } from "./kit";

export type TemplateIcon = "mail" | "briefcase" | "scale" | "user" | "calendar" | "star" | "upload" | "list" | "clock" | "pen";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: "Allgemein" | "Kanzlei" | "Personal" | "Veranstaltung" | "Feedback";
  icon: TemplateIcon;
  build: () => FormDefinition;
}

function kontakt(): FormDefinition {
  const k = new Kit();
  return build(
    "Kontakt",
    [
      k.page("", [
        k.field("name", "Ihr Name", { required: true }),
        k.field("email", "E-Mail", { required: true, width: "half", placeholder: "name@beispiel.de", key: "email" }),
        k.field("phone", "Telefon (optional)", { width: "half", key: "telefon", placeholder: "Falls Sie lieber angerufen werden" }),
        k.field("short_text", "Betreff", { required: true, validation: { maxLength: 150 } }),
        k.field("long_text", "Ihre Nachricht", { required: true, validation: { maxLength: 4000 } }),
        k.field("consent", "Datenschutz", { consentText: PRIVACY, required: true }),
      ]),
    ],
    {
      description: "Schreiben Sie uns – wir antworten in der Regel innerhalb eines Werktags.",
      endings: [k.ending("Danke, Ihre Nachricht ist angekommen.", "Wir melden uns so bald wie möglich bei Ihnen unter {{email}}.")],
      settings: { submitLabel: "Nachricht senden" },
    },
  );
}

function kundenanfrage(): FormDefinition {
  const k = new Kit();
  const firma = k.field("short_text", "Unternehmen", { required: true, width: "half", key: "unternehmen" });
  const name = k.field("name", "Ansprechpartner", { required: true });
  const email = k.field("email", "E-Mail", { required: true, width: "half" });
  const phone = k.field("phone", "Telefon", { width: "half" });
  const interesse = k.choice("checkboxes", "Wofür interessieren Sie sich?", ["Beratung", "Angebot für ein Projekt", "Wartung und Betreuung", "Schulung", "Etwas anderes"], { required: true, allowOther: false });
  const budget = k.field("currency", "Budgetrahmen", { width: "half", description: "Eine grobe Einschätzung genügt." });
  const zeit = k.choice("dropdown", "Zeitrahmen", ["So schnell wie möglich", "In den nächsten 3 Monaten", "In diesem Jahr", "Noch offen"], { width: "half" });
  const msg = k.field("long_text", "Beschreiben Sie Ihr Vorhaben", { required: true, validation: { minLength: 20, maxLength: 6000 }, placeholder: "Worum geht es, was ist das Ziel, gibt es Fristen?" });
  const quelle = k.field("hidden", "Quelle", { key: "quelle", urlParam: "quelle" });
  const consent = k.field("consent", "Datenschutz", { consentText: PRIVACY, required: true });
  return build("Kundenanfrage", [k.page("", [firma, name, email, phone, interesse, budget, zeit, msg, quelle, consent])], {
    description: "Erzählen Sie uns kurz von Ihrem Vorhaben. Wir melden uns mit einem konkreten Vorschlag.",
    endings: [k.ending("Vielen Dank für Ihre Anfrage", "Wir prüfen Ihr Anliegen und melden uns innerhalb von zwei Werktagen bei {{name}}.")],
    settings: { submitLabel: "Anfrage senden" },
  });
}

function mandantenaufnahme(): FormDefinition {
  const k = new Kit();
  const art = k.choiceValues("single_choice", "Sie wenden sich an uns als", [["privat", "Privatperson"], ["unternehmen", "Unternehmen oder Organisation"]], { required: true, key: "art" });
  const firma = k.field("short_text", "Name des Unternehmens", { required: true, key: "firma" });
  const rechtsform = k.choice("dropdown", "Rechtsform", ["GmbH", "UG (haftungsbeschränkt)", "AG", "GbR", "OHG / KG", "Einzelunternehmen", "Verein", "Sonstige"], { width: "half" });
  const hr = k.field("short_text", "Handelsregisternummer", { width: "half", placeholder: "z. B. HRB 12345 (falls vorhanden)" });
  const name = k.field("name", "Ihr Name", { required: true, nameParts: ["title", "first", "last"], key: "name" });
  const geburt = k.field("date", "Geburtsdatum", { width: "half", validation: { maxDate: "-14y" } });
  const email = k.field("email", "E-Mail", { required: true, width: "half", key: "email" });
  const phone = k.field("phone", "Telefon", { required: true, width: "half" });
  const adresse = k.field("address", "Anschrift", { required: true });

  const gebiet = k.choice("dropdown", "Rechtsgebiet", ["Arbeitsrecht", "Zivilrecht / Vertragsrecht", "Mietrecht", "Familienrecht", "Strafrecht", "Verwaltungsrecht", "Gesellschaftsrecht", "Weiß ich nicht"], { required: true });
  const gegner = k.field("short_text", "Gegenseite", { description: "Name der Person, des Unternehmens oder der Behörde, gegen die sich Ihr Anliegen richtet. Wir benötigen diese Angabe für die Prüfung von Interessenkonflikten.", required: true });
  const sachverhalt = k.field("long_text", "Was ist passiert?", { required: true, validation: { minLength: 30, maxLength: 10_000 }, placeholder: "Schildern Sie den Ablauf möglichst mit Daten. Stichpunkte genügen." });
  const ziel = k.field("long_text", "Was möchten Sie erreichen?", { validation: { maxLength: 3000 } });
  const frist = k.field("yes_no", "Läuft eine Frist?", { required: true, description: "Zum Beispiel aus einer Kündigung, einem Bescheid oder einem gerichtlichen Schreiben." });
  const fristdatum = k.field("date", "Wann endet die Frist?", { required: true, width: "half", key: "fristende" });
  const streitwert = k.field("currency", "Um welchen Betrag geht es ungefähr?", { width: "half", description: "Falls bezifferbar." });
  const rs = k.field("yes_no", "Haben Sie eine Rechtsschutzversicherung?", { required: true });
  const rsName = k.field("short_text", "Versicherung und Versicherungsnummer", { width: "full", placeholder: "z. B. ARAG, 123 456 789" });

  const unterlagen = k.field("paragraph", "", { description: "Laden Sie hier alles hoch, was zu Ihrem Anliegen gehört: Verträge, Schreiben der Gegenseite, Bescheide, Kündigung, E-Mails. Fotos mit dem Handy genügen." });
  const docs = k.field("file", "Unterlagen", { maxFiles: 10, maxFileSizeMb: 20, accept: ["application/pdf", "image/jpeg", "image/png", "image/heic", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] });

  const datenschutz = k.field("consent", "Datenschutz", { required: true, consentText: "Ich willige ein, dass die Kanzlei meine Angaben und Unterlagen zur Prüfung und Bearbeitung meines Anliegens verarbeitet. Mir ist bekannt, dass durch dieses Formular noch kein Mandat zustande kommt." });
  const mail = k.field("consent", "Kommunikation per E-Mail", { required: false, consentText: "Die Kanzlei darf mit mir unverschlüsselt per E-Mail kommunizieren. Mir ist bewusst, dass unverschlüsselte E-Mails von Dritten gelesen werden können." });

  const p1 = k.page("Über Sie", [art, firma, rechtsform, hr, name, geburt, email, phone, adresse], "Diese Angaben brauchen wir, um Sie zu erreichen und mögliche Interessenkonflikte auszuschließen.");
  const p2 = k.page("Ihr Anliegen", [gebiet, gegner, sachverhalt, ziel, frist, fristdatum, streitwert, rs, rsName]);
  const p3 = k.page("Unterlagen", [unterlagen, docs]);
  const p4 = k.page("Einwilligung", [datenschutz, mail]);

  const eilig = k.ending("Ihre Anfrage ist eingegangen – wir melden uns umgehend", "Danke, {{name}}. Weil eine Frist läuft (Ende: {{fristende}}), prüfen wir Ihre Anfrage vorrangig und rufen Sie spätestens am nächsten Werktag an.\n\nBitte unternehmen Sie bis dahin nichts, was die Frist versäumen könnte.");
  const normal = k.ending("Ihre Anfrage ist eingegangen", "Danke, {{name}}. Wir prüfen Ihr Anliegen und melden uns innerhalb von zwei Werktagen per E-Mail oder Telefon.");

  return build("Mandantenaufnahme", [p1, p2, p3, p4], {
    description: "In wenigen Schritten zu Ihrer Erstberatung. Ihre Angaben unterliegen der anwaltlichen Schweigepflicht.",
    rules: [
      k.rule([{ fieldId: art.id, operator: "eq", value: "unternehmen" }], [{ type: "show", target: firma.id }, { type: "show", target: rechtsform.id }, { type: "show", target: hr.id }], "Unternehmensdaten nur für Unternehmen"),
      k.rule([{ fieldId: art.id, operator: "eq", value: "privat" }], [{ type: "show", target: geburt.id }], "Geburtsdatum nur für Privatpersonen"),
      k.rule([{ fieldId: frist.id, operator: "eq", value: true }], [{ type: "show", target: fristdatum.id }, { type: "set_ending", target: eilig.id }], "Laufende Frist"),
      k.rule([{ fieldId: rs.id, operator: "eq", value: true }], [{ type: "show", target: rsName.id }], "Rechtsschutzversicherung"),
      k.rule([{ fieldId: streitwert.id, operator: "gt", value: 50_000 }], [{ type: "require", target: ziel.id }], "Hoher Streitwert: Ziel angeben"),
    ],
    endings: [normal, eilig],
    settings: { mode: "wizard", reviewStep: true, submitLabel: "Anfrage verbindlich senden", allowResume: true, theme: { accent: "#2f4a7a", radius: "medium", font: "sans", background: "plain" } },
  });
}

function bewerbung(): FormDefinition {
  const k = new Kit();
  const stelle = k.choice("dropdown", "Für welche Stelle bewerben Sie sich?", ["Sachbearbeitung", "Assistenz / Sekretariat", "Fachkraft", "Auszubildende/r", "Initiativbewerbung"], { required: true });
  const name = k.field("name", "Name", { required: true });
  const email = k.field("email", "E-Mail", { required: true, width: "half" });
  const phone = k.field("phone", "Telefon", { required: true, width: "half" });
  const adresse = k.field("address", "Anschrift");
  const start = k.field("date", "Frühestes Eintrittsdatum", { width: "half", validation: { minDate: "today" } });
  const gehalt = k.field("currency", "Gehaltsvorstellung (brutto/Jahr)", { width: "half" });
  const umfang = k.choice("single_choice", "Gewünschter Umfang", ["Vollzeit", "Teilzeit", "Flexibel"], { required: true });
  const cv = k.field("file", "Lebenslauf", { required: true, maxFiles: 1, maxFileSizeMb: 10, accept: ["application/pdf"], description: "Bitte als PDF." });
  const weitere = k.field("file", "Anschreiben, Zeugnisse und Nachweise", { maxFiles: 8, maxFileSizeMb: 15, accept: ["application/pdf", "image/jpeg", "image/png"] });
  const motivation = k.field("long_text", "Warum passen Sie zu uns?", { validation: { maxLength: 3000 }, description: "Optional, falls Sie kein Anschreiben beifügen." });
  const quelle = k.choice("dropdown", "Wie sind Sie auf uns aufmerksam geworden?", ["Website", "Stellenportal", "Empfehlung", "Social Media", "Sonstiges"]);
  const consent = k.field("consent", "Datenschutz", { required: true, consentText: "Ich willige ein, dass meine Bewerbungsunterlagen für dieses Bewerbungsverfahren verarbeitet und spätestens sechs Monate nach dessen Abschluss gelöscht werden." });
  return build("Bewerbung", [k.page("Zur Person", [stelle, name, email, phone, adresse]), k.page("Rahmen", [start, gehalt, umfang]), k.page("Unterlagen", [cv, weitere, motivation, quelle, consent])], {
    description: "Schön, dass Sie sich für uns interessieren. Die Bewerbung dauert etwa fünf Minuten.",
    endings: [k.ending("Danke für Ihre Bewerbung", "Wir haben Ihre Unterlagen erhalten und melden uns innerhalb von zwei Wochen bei Ihnen.")],
    settings: { mode: "wizard", reviewStep: true, submitLabel: "Bewerbung absenden" },
  });
}

function veranstaltung(): FormDefinition {
  const k = new Kit();
  const name = k.field("name", "Name", { required: true });
  const email = k.field("email", "E-Mail", { required: true, width: "half" });
  const firma = k.field("short_text", "Unternehmen / Organisation", { width: "half" });
  const ticket = k.choiceValues("single_choice", "Teilnahme", [["vor_ort", "Vor Ort (45 €)"], ["online", "Online (kostenlos)"]], { required: true, key: "teilnahme" });
  const begleitung = k.field("yes_no", "Bringen Sie Begleitpersonen mit?", { required: true });
  const bName = k.field("short_text", "Name der Begleitperson", { required: true, key: "begleitung_name" });
  const bVeg = k.field("yes_no", "Vegetarisches Essen", { key: "begleitung_vegetarisch" });
  const gruppe = k.field("group", "Begleitpersonen", { fields: [bName, bVeg], minItems: 1, maxItems: 4, itemLabel: "Begleitperson", key: "begleitpersonen", description: "Je Begleitperson 35 €." });
  const essen = k.choice("single_choice", "Ihre Essenswahl", ["Klassisch", "Vegetarisch", "Vegan"], { required: true });
  const preis = k.field("calculated", "Teilnahmebetrag", { expression: 'if({teilnahme} == "vor_ort", 45 + count({begleitung_name}) * 35, 0)', decimals: 2, currency: "EUR", description: "Die Rechnung erhalten Sie nach der Anmeldung per E-Mail.", key: "betrag" });
  const workshops = k.choice("checkboxes", "Welche Workshops möchten Sie besuchen?", ["Digitale Abläufe in der Praxis", "Datenschutz kompakt", "Projekte sicher steuern", "KI im Arbeitsalltag"], { validation: { maxSelected: 2 }, description: "Höchstens zwei – die Plätze sind begrenzt." });
  const hinweis = k.field("long_text", "Hinweise (z. B. Barrierefreiheit, Allergien)", { validation: { maxLength: 1000 } });
  const consent = k.field("consent", "Datenschutz", { required: true, consentText: "Ich bin damit einverstanden, dass meine Angaben zur Organisation der Veranstaltung verarbeitet werden. Fotos der Veranstaltung können veröffentlicht werden; ich kann dem jederzeit widersprechen." });
  return build("Anmeldung Sommerforum 2027", [k.page("", [name, email, firma, ticket, essen, begleitung, gruppe, workshops, preis, hinweis, consent])], {
    description: "Freitag, 18. Juni 2027, 14 bis 19 Uhr · Haus am Markt, Saal 2 und online.",
    rules: [
      k.rule([{ fieldId: ticket.id, operator: "eq", value: "vor_ort" }], [{ type: "show", target: essen.id }, { type: "show", target: begleitung.id }], "Vor-Ort-Angaben"),
      k.rule([{ fieldId: begleitung.id, operator: "eq", value: true }], [{ type: "show", target: gruppe.id }], "Begleitpersonen"),
    ],
    endings: [k.ending("Sie sind angemeldet!", "Danke, {{name}}. Die Bestätigung mit allen Details kommt in wenigen Minuten an {{email}}. Ihr Betrag: {{betrag}}.")],
    settings: { submitLabel: "Verbindlich anmelden", theme: { accent: "#0e6b58", radius: "large", font: "sans", background: "plain" } },
  });
}

function feedback(): FormDefinition {
  const k = new Kit();
  const gesamt = k.field("rating", "Wie zufrieden sind Sie insgesamt mit uns?", { required: true, ratingMax: 5, ratingIcon: "star" });
  const matrix = k.field("matrix", "Wie bewerten Sie diese Punkte?", {
    matrix: {
      rows: [
        { id: "r_erreich", label: "Erreichbarkeit", value: "Erreichbarkeit" },
        { id: "r_verst", label: "Verständliche Erklärungen", value: "Verständliche Erklärungen" },
        { id: "r_tempo", label: "Bearbeitungsdauer", value: "Bearbeitungsdauer" },
        { id: "r_preis", label: "Preis-Leistung", value: "Preis-Leistung" },
      ],
      columns: [
        { id: "c1", label: "Schlecht", value: "1" },
        { id: "c2", label: "Geht so", value: "2" },
        { id: "c3", label: "Gut", value: "3" },
        { id: "c4", label: "Sehr gut", value: "4" },
      ],
      multiple: false,
    },
  });
  const nps = k.field("slider", "Wie wahrscheinlich ist es, dass Sie uns weiterempfehlen?", { required: true, validation: { min: 0, max: 10, step: 1 }, sliderLabels: ["Unwahrscheinlich", "Sehr wahrscheinlich"], key: "empfehlung" });
  const gut = k.field("long_text", "Was hat Ihnen besonders gefallen?", { validation: { maxLength: 2000 } });
  const besser = k.field("long_text", "Was sollen wir besser machen?", { validation: { maxLength: 2000 }, description: "Jede Kritik hilft uns." });
  const kontakt = k.field("yes_no", "Dürfen wir Sie zu Ihrem Feedback kontaktieren?");
  const email = k.field("email", "Ihre E-Mail-Adresse", { required: true });
  return build("Wie war es mit uns?", [k.page("", [gesamt, matrix, nps, gut, besser, kontakt, email])], {
    description: "Zwei Minuten, die uns sehr helfen. Ihre Antworten sind ohne Kontaktwunsch anonym.",
    rules: [
      k.rule([{ fieldId: kontakt.id, operator: "eq", value: true }], [{ type: "show", target: email.id }], "Kontakt nur auf Wunsch"),
      k.rule([{ fieldId: gesamt.id, operator: "lte", value: 2 }], [{ type: "require", target: besser.id }], "Bei schlechter Bewertung nachfragen"),
    ],
    endings: [k.ending("Danke für Ihr Feedback!", "Wir lesen jede Antwort persönlich.")],
    settings: { mode: "cards", submitLabel: "Feedback senden", theme: { accent: "#b4532a", radius: "large", font: "sans", background: "plain" } },
  });
}

function dokumente(): FormDefinition {
  const k = new Kit();
  const name = k.field("name", "Ihr Name", { required: true, key: "name" });
  const email = k.field("email", "E-Mail", { required: true, width: "half" });
  const az = k.field("short_text", "Vorgangsnummer", { width: "half", placeholder: "z. B. 2026-0042", description: "Steht auf unseren Schreiben, falls vorhanden.", validation: { maxLength: 40 } });
  const art = k.choice("checkboxes", "Was senden Sie uns?", ["Vertrag", "Schreiben / Korrespondenz", "Bescheid / Behördenschreiben", "Rechnung / Beleg", "Nachweis / Bescheinigung", "Sonstiges"], { required: true });
  const files = k.field("file", "Dokumente", { required: true, maxFiles: 15, maxFileSizeMb: 25 });
  const eingang = k.field("date", "Wann haben Sie das Schreiben erhalten?", { width: "half", validation: { maxDate: "today" }, description: "Hilft uns bei der Einordnung, etwa wenn eine Frist läuft." });
  const bemerkung = k.field("long_text", "Möchten Sie uns etwas dazu sagen?", { validation: { maxLength: 3000 } });
  const consent = k.field("consent", "Datenschutz", { required: true, consentText: PRIVACY });
  return build("Dokumente einreichen", [k.page("", [name, email, az, art, eingang, files, bemerkung, consent])], {
    description: "Sicher und ohne E-Mail: Laden Sie Unterlagen direkt zu Ihrem Vorgang hoch.",
    endings: [k.ending("Ihre Dokumente sind angekommen", "Danke, {{name}}. Wir ordnen die Unterlagen Ihrem Vorgang zu und melden uns, falls etwas fehlt.")],
    settings: { submitLabel: "Dokumente senden" },
  });
}

function fragebogen(): FormDefinition {
  const k = new Kit();
  const rolle = k.choice("single_choice", "In welcher Funktion arbeiten Sie?", ["Geschäftsführung", "Fachabteilung", "IT", "Verwaltung", "Sonstiges"], { required: true });
  const groesse = k.choice("dropdown", "Wie viele Personen arbeiten in Ihrer Organisation?", ["1–9", "10–49", "50–249", "250 und mehr"], { required: true });
  const nutzt = k.field("yes_no", "Nutzen Sie bereits digitale Formulare?", { required: true });
  const werkzeug = k.choice("checkboxes", "Welche Werkzeuge nutzen Sie dafür?", ["Online-Formulardienst", "PDF-Formulare", "Eigene Website", "Fachsoftware", "Sonstiges"], { required: true });
  const anzahl = k.field("number", "Wie viele Formulare werden pro Monat ungefähr ausgefüllt?", { validation: { min: 0, max: 1_000_000 }, width: "half" });
  const zufrieden = k.field("rating", "Wie zufrieden sind Sie damit?", { ratingMax: 5 });
  const hemmnis = k.choice("checkboxes", "Was hält Sie bisher davon ab?", ["Datenschutzbedenken", "Kein passendes Werkzeug", "Zu aufwendig", "Keine Zeit", "Kein Bedarf"], { required: true });
  const wichtig = k.field("matrix", "Wie wichtig sind Ihnen diese Eigenschaften?", {
    matrix: {
      rows: [
        { id: "w_ds", label: "Daten bleiben auf eigenem Server", value: "Eigener Server" },
        { id: "w_easy", label: "Einfache Bedienung", value: "Einfache Bedienung" },
        { id: "w_auto", label: "Automatische Weiterverarbeitung", value: "Automatisierung" },
        { id: "w_pdf", label: "PDF-Ausgabe", value: "PDF" },
      ],
      columns: [
        { id: "u", label: "Unwichtig", value: "unwichtig" },
        { id: "n", label: "Neutral", value: "neutral" },
        { id: "w", label: "Wichtig", value: "wichtig" },
      ],
      multiple: false,
    },
  });
  const sonst = k.field("long_text", "Was möchten Sie uns noch mitteilen?", { validation: { maxLength: 2000 } });
  const p1 = k.page("Über Sie", [rolle, groesse, nutzt]);
  const p2 = k.page("Ihre Erfahrungen", [werkzeug, anzahl, zufrieden]);
  const p3 = k.page("Was Sie bremst", [hemmnis]);
  const p4 = k.page("Zum Schluss", [wichtig, sonst]);
  return build("Umfrage: Digitale Formulare im Alltag", [p1, p2, p3, p4], {
    description: "Vier kurze Abschnitte, etwa drei Minuten. Je nach Antwort überspringen wir Fragen, die für Sie nicht passen.",
    rules: [
      k.rule([{ fieldId: nutzt.id, operator: "eq", value: false }], [{ type: "skip_to", target: p3.id }], "Nicht-Nutzer überspringen die Erfahrungen"),
      k.rule([{ fieldId: nutzt.id, operator: "eq", value: true }], [{ type: "hide", target: p3.id }], "Nutzer werden nicht nach Hemmnissen gefragt"),
    ],
    endings: [k.ending("Vielen Dank fürs Mitmachen!", "Die Ergebnisse veröffentlichen wir im Frühjahr.")],
    settings: { mode: "wizard", reviewStep: false, submitLabel: "Antworten senden" },
  });
}

function terminwunsch(): FormDefinition {
  const k = new Kit();
  const name = k.field("name", "Name", { required: true });
  const email = k.field("email", "E-Mail", { required: true, width: "half" });
  const phone = k.field("phone", "Telefon", { required: true, width: "half" });
  const anlass = k.choice("dropdown", "Worum geht es?", ["Erstgespräch", "Besprechung zu einem laufenden Vorgang", "Beratung", "Sonstiges"], { required: true });
  const art = k.choiceValues("single_choice", "Wie möchten Sie sprechen?", [["vor_ort", "Vor Ort"], ["telefon", "Telefonisch"], ["video", "Per Video"]], { required: true });
  const tag1 = k.field("date", "Wunschtermin", { required: true, width: "half", validation: { minDate: "+1d", maxDate: "+90d" } });
  const zeit = k.choice("single_choice", "Bevorzugte Tageszeit", ["Vormittags (9–12 Uhr)", "Mittags (12–14 Uhr)", "Nachmittags (14–18 Uhr)"], { required: true, width: "half" });
  const tag2 = k.field("date", "Ausweichtermin", { width: "half", validation: { minDate: "+1d", maxDate: "+90d" } });
  const barrierefrei = k.field("yes_no", "Benötigen Sie einen barrierefreien Zugang?");
  const notiz = k.field("long_text", "Kurze Beschreibung", { validation: { maxLength: 1500 }, description: "Damit wir uns vorbereiten können." });
  const consent = k.field("consent", "Datenschutz", { required: true, consentText: PRIVACY });
  return build("Terminanfrage", [k.page("", [name, email, phone, anlass, art, tag1, zeit, tag2, barrierefrei, notiz, consent])], {
    description: "Nennen Sie uns Ihren Wunschtermin. Wir bestätigen ihn per E-Mail oder schlagen eine Alternative vor.",
    rules: [k.rule([{ fieldId: art.id, operator: "eq", value: "vor_ort" }], [{ type: "show", target: barrierefrei.id }], "Barrierefreiheit nur vor Ort")],
    endings: [k.ending("Ihre Terminanfrage ist da", "Wir prüfen den {{wunschtermin}} und bestätigen innerhalb eines Werktags.")],
    settings: { submitLabel: "Termin anfragen" },
  });
}

function einwilligung(): FormDefinition {
  const k = new Kit();
  const name = k.field("name", "Vor- und Nachname", { required: true });
  const email = k.field("email", "E-Mail", { width: "half" });
  const text = k.field("paragraph", "", {
    description:
      "Ich willige ein, dass Fotos und Videos, auf denen ich zu erkennen bin, für die unten angekreuzten Zwecke veröffentlicht werden dürfen. Eine Vergütung erfolgt nicht.\n\nDie Einwilligung ist freiwillig. Ich kann sie jederzeit mit Wirkung für die Zukunft widerrufen; bereits gedruckte Medien sind davon nicht erfasst.",
  });
  const umfang = k.choice("checkboxes", "Die Einwilligung gilt für", ["Website", "Soziale Medien", "Flyer und Broschüren", "Interne Mitteilungen", "Presse"], { required: true });
  const zustimmung = k.field("consent", "Erklärung", { required: true, consentText: "Ich habe die Erklärung gelesen und erteile die Einwilligung im angekreuzten Umfang." });
  const ort = k.field("short_text", "Ort", { required: true, width: "half" });
  const sig = k.field("signature", "Unterschrift", { required: true });
  return build("Einwilligung Foto- und Videoaufnahmen", [k.page("", [name, email, text, umfang, zustimmung, ort, sig])], {
    description: "Bitte lesen Sie die Erklärung sorgfältig und unterschreiben Sie am Ende mit Finger, Stift oder Maus.",
    endings: [k.ending("Danke, Ihre Erklärung liegt uns vor", "Sie erhalten eine Kopie als PDF von uns. Die Unterschrift ist eine einfache elektronische Unterschrift.")],
    settings: { submitLabel: "Verbindlich unterschreiben" },
  });
}

export const TEMPLATES: Template[] = [
  { id: "kontakt", name: "Kontaktformular", description: "Name, E-Mail, Nachricht und Einwilligung – in zwei Minuten online.", category: "Allgemein", icon: "mail", build: kontakt },
  { id: "kundenanfrage", name: "Kundenanfrage", description: "Projektanfragen mit Interessen, Budget und Zeitrahmen; Quelle aus dem Link.", category: "Allgemein", icon: "briefcase", build: kundenanfrage },
  { id: "mandantenaufnahme", name: "Mandantenaufnahme", description: "Privatperson oder Unternehmen, Gegenseite, Fristen, Unterlagen – mit Zusammenfassung vor dem Absenden.", category: "Kanzlei", icon: "scale", build: mandantenaufnahme },
  { id: "bewerbung", name: "Bewerbungsformular", description: "Stelle, Kontaktdaten, Lebenslauf als PDF und Nachweise in drei Schritten.", category: "Personal", icon: "user", build: bewerbung },
  { id: "veranstaltung", name: "Veranstaltungsanmeldung", description: "Teilnahme vor Ort oder online, Begleitpersonen und automatisch berechneter Betrag.", category: "Veranstaltung", icon: "calendar", build: veranstaltung },
  { id: "feedback", name: "Feedbackformular", description: "Eine Frage pro Bildschirm: Sterne, Matrix, Weiterempfehlung.", category: "Feedback", icon: "star", build: feedback },
  { id: "dokumente", name: "Dokumentenupload", description: "Unterlagen sicher hochladen, mit Vorgangsnummer und Eingangsdatum.", category: "Allgemein", icon: "upload", build: dokumente },
  { id: "fragebogen", name: "Mehrstufiger Fragebogen", description: "Umfrage in vier Abschnitten, die je nach Antwort Fragen überspringt.", category: "Feedback", icon: "list", build: fragebogen },
  { id: "terminwunsch", name: "Terminwunsch", description: "Wunschtermin, Ausweichtermin, Gesprächsart und Tageszeit.", category: "Allgemein", icon: "clock", build: terminwunsch },
  { id: "einwilligung", name: "Einwilligungserklärung", description: "Einwilligung in Foto- und Videoaufnahmen mit elektronischer Unterschrift.", category: "Allgemein", icon: "pen", build: einwilligung },
];

export function templateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
