# Integrationen: REST-API und Webhooks

PLICA bietet zwei Wege, andere Systeme anzubinden:

- **REST-API** (abrufen): Ein anderes System fragt Formulare und Antworten ab, lädt PDFs und Dateien und kann Status und Tags setzen.
- **Webhooks** (zustellen): PLICA meldet ein Ereignis sofort per signiertem `POST` an ein anderes System.

Beide arbeiten immer innerhalb **eines** Workspace. Typisch ist die Kombination: Ein Webhook meldet „Mandat freigegeben“, der Empfänger holt sich über die API das PDF und meldet den Status zurück.

## REST-API

### Schlüssel anlegen

Öffnen Sie **Einstellungen → API und Webhooks** und klicken Sie auf **Neuer Schlüssel**. Diese Seite sehen nur Administratoren und Inhaber.

- **Name:** wofür der Schlüssel dient, z. B. „CRM-Anbindung“.
- **Rechte:** **Nur lesen** oder **Lesen und schreiben**.
- **Gültig:** 30 Tage, 90 Tage, 1 Jahr (Voreinstellung) oder Unbegrenzt.

Der Schlüssel beginnt mit `plc_` und wird **nur einmal** angezeigt. Kopieren Sie ihn sofort in die Konfiguration des anderen Systems. PLICA speichert nur eine SHA-256-Prüfsumme; ein verlorener Schlüssel lässt sich nicht wieder anzeigen, nur ersetzen.

Die Liste zeigt je Schlüssel Name, Rechte, den Anfang des Schlüssels, den Besitzer, die letzte Nutzung und das Ablaufdatum. **Widerrufen** sperrt einen Schlüssel sofort; Systeme, die ihn nutzen, erhalten danach `401`.

**Wirksame Rechte.** Ein Schlüssel kann nie mehr als die Rolle seines Besitzers – der Person, die ihn angelegt hat. Maßgeblich ist immer die aktuelle Rolle:

- Lesen setzt mindestens die Rolle Leser voraus.
- Status und Tags ändern setzt **Lesen und schreiben** und mindestens die Rolle Prüfer voraus.
- Verlässt der Besitzer den Workspace oder wird sein Konto deaktiviert, wirkt der Schlüssel sofort nicht mehr.

### Aufrufe

Die API liegt unter der Adresse der **Verwaltung** (`APP_URL`), nicht unter der öffentlichen Formular-Domain:

```bash
curl -H "Authorization: Bearer plc_…" https://plica.kanzlei.local/api/v1/forms
```

Ist eine eigene `PUBLIC_URL` eingerichtet, antwortet die öffentliche Domain auf `/api/v1` mit „Nicht gefunden“ ([Kapitel 5](05-veroeffentlichen-teilen.md#zwei-adressen-formulare-öffentlich-verwaltung-intern)). Systeme im internen Netz erreichen die API also, Fremde aus dem Internet nicht.

| Methode | Pfad | Zweck | Mindestrecht |
|---|---|---|---|
| GET | `/api/v1/forms` | alle Formulare des Workspace (auch Entwürfe und archivierte) | lesen |
| GET | `/api/v1/forms/{id}` | Formular mit öffentlicher Adresse (`publicUrl`) und veröffentlichter Definition | lesen |
| GET | `/api/v1/forms/{id}/submissions` | Antworten, älteste zuerst; Parameter `since`, `status`, `limit` (1–200, Standard 50), `cursor` | lesen |
| GET | `/api/v1/submissions/{id}` | eine Antwort mit Dateiliste | lesen |
| PATCH | `/api/v1/submissions/{id}` | `status` und/oder `tags` ändern | schreiben, Rolle Prüfer |
| GET | `/api/v1/submissions/{id}/pdf` | Antwort als PDF (Standardvorlage) | lesen |
| GET | `/api/v1/files/{id}` | Upload, Unterschrift oder erzeugtes PDF | lesen |

### OpenAPI-Beschreibung

Die maschinenlesbare Beschreibung im Format OpenAPI 3.1 liefert PLICA ohne Schlüssel unter

```
https://plica.kanzlei.local/api/v1/openapi.json
```

Sie lässt sich in Werkzeuge wie Postman, Insomnia oder einen Code-Generator laden. Je Pfad nennt sie das benötigte Recht (`x-permission`, `x-scope`). Ein automatischer Test im Projekt stellt sicher, dass jede API-Route dort beschrieben ist. Der Link steht auch auf der Seite **API und Webhooks**.

### Antworten lesen und synchronisieren

Eine Antwort sieht so aus:

```json
{
  "id": "5f0c…",
  "number": 17,
  "formId": "a1b2…",
  "formVersion": 3,
  "status": "approved",
  "tags": ["eilig"],
  "starred": false,
  "submittedAt": "2026-10-22T09:12:03.120Z",
  "updatedAt": "2026-10-22T10:40:11.004Z",
  "answers": {
    "name": { "first": "Erika", "last": "Mustermann" },
    "email": "erika@beispiel.de",
    "rechtsgebiet": "arbeitsrecht"
  },
  "display": {
    "name": { "label": "Ihr Name", "text": "Erika Mustermann", "type": "name" },
    "email": { "label": "E-Mail", "text": "erika@beispiel.de", "type": "email" },
    "rechtsgebiet": { "label": "Rechtsgebiet", "text": "Arbeitsrecht", "type": "dropdown" }
  }
}
```

- `answers` enthält die **Rohwerte nach Feldschlüssel** – unabhängig von Beschriftungen, die Sie im Editor ändern. Auswahlfelder liefern den gespeicherten Wert, Namen und Anschriften ein Objekt, Datei-Felder eine Liste mit `id`, `name`, `size` und `type`.
- `display` enthält dieselben Felder als lesbaren Text mit Beschriftung und Feldtyp.
- Leere Felder fehlen in beiden.
- Die Feldschlüssel richten sich nach der Formularversion, mit der die Antwort abgesendet wurde (`formVersion`).
- `GET /submissions/{id}` liefert zusätzlich `files` mit `id`, `name`, `mime`, `size`, `kind` (`upload`, `signature`, `pdf`), `status` und `fieldId`.

**Synchronisieren:** Fragen Sie mit `since=<ISO-Zeitpunkt>` ab und folgen Sie dann `nextCursor`, bis er `null` ist. Für die nächste Seite hängen Sie `cursor=<nextCursor>` an; die übrigen Parameter bleiben gleich. Die Reihenfolge ist stabil (Eingang, dann ID), auch wenn mehrere Antworten in derselben Sekunde eingehen.

```bash
curl -H "Authorization: Bearer $PLICA_TOKEN" \
  "https://plica.kanzlei.local/api/v1/forms/<formular-id>/submissions?since=2026-10-01T00:00:00Z&limit=200"
```

Anders als die Antwortliste in der Oberfläche blendet die API Spam nicht aus. Filtern Sie bei Bedarf mit `status=` (ein Wert: `new`, `in_review`, `approved`, `rejected`, `done` oder `spam`).

### Status und Tags setzen

```bash
curl -X PATCH -H "Authorization: Bearer $PLICA_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done","tags":["eilig","akte-angelegt"]}' \
  https://plica.kanzlei.local/api/v1/submissions/<antwort-id>
```

- Mindestens `status` oder `tags` ist anzugeben; unbekannte Felder im Body lehnt PLICA ab (`400 invalid_request`).
- `tags` **ersetzt** die vollständige Liste (höchstens 30 Tags mit je höchstens 40 Zeichen). Um einen Tag hinzuzufügen, senden Sie die bisherigen Tags mit.
- Eine Statusänderung startet Automationen mit dem Auslöser „Status einer Antwort geändert“, genau wie eine Änderung in der Oberfläche.
- Die Antwort enthält die aktualisierte Antwort. Verlauf und Protokoll vermerken die Änderung („Tags über die API gesetzt“).

### Dateien und PDFs

`GET /submissions/{id}/pdf` erzeugt das PDF nach der Standard-PDF-Vorlage des Formulars ([Kapitel 7](07-export-pdf.md#pdf-vorlage)).

`GET /files/{id}` liefert eine Datei mit den Headern `x-plica-sha256` (Prüfsumme zum Abgleich) und `x-plica-scan` (Prüfstatus: `clean` oder `unscanned`). Dabei gilt:

| Antwort | Bedeutung |
|---|---|
| 200 | Datei ist virengeprüft (bzw. eine Unterschrift oder ein von PLICA erzeugtes PDF) – oder ungeprüft, aber in der Oberfläche bewusst freigegeben (`x-plica-scan: unscanned`) |
| 423 `file_quarantined` | Datei ist ungeprüft in Quarantäne und noch nicht freigegeben |
| 410 `file_infected` | Datei wurde als schädlich erkannt |

Eine ungeprüfte Datei wird abrufbar, sobald eine berechtigte Person sie in der Antwort mit **Ungeprüft freigeben …** freigibt oder die Prüfung („Jetzt prüfen“ oder automatische Nachprüfung) sie für sauber erklärt. Integrationen, die Uploads weiterverarbeiten, können über `x-plica-scan` erkennen, ob eine Datei ohne Virenprüfung kommt. Dauerhaft sinnvoll ist ein Virenscanner ([Kapitel 20](20-installation.md#mit-virenscanner)).

Jeder Abruf von PDF und Datei über die API steht im Protokoll des Workspace.

### Fehler und Grenzen

Fehler haben immer die Form `{ "error": { "code": "…", "message": "…" } }`:

| Status und Code | Bedeutung |
|---|---|
| 400 `invalid_request`, `invalid_json`, `invalid_cursor` | Anfrage fehlerhaft; `message` nennt das Feld |
| 401 `unauthorized` | Schlüssel fehlt, ist ungültig, abgelaufen oder widerrufen, oder der Besitzer hat keinen Zugriff mehr |
| 403 `insufficient_scope` | Schlüssel darf nur lesen |
| 403 `forbidden` | Rolle des Besitzers reicht nicht |
| 404 `not_found` | nicht vorhanden **oder** in einem anderen Workspace (bewusst nicht unterscheidbar) |
| 410, 423 | siehe [Dateien und PDFs](#dateien-und-pdfs) |
| 429 `rate_limited` | mehr als 600 Anfragen pro Minute und Schlüssel; Header `retry-after` in Sekunden |
| 500 `internal` | interner Fehler; Details nur im Server-Log |

## Webhooks

Webhooks richten Sie in einem Formular im Reiter **Automationen** mit dem Schritt **Webhook auslösen** ein ([Kapitel 8](08-automationen.md#webhook-auslösen)). Das Geheimnis für die Signatur gilt für den ganzen Workspace.

### Was gesendet wird

`POST` an die eingetragene Adresse mit `Content-Type: application/json`:

```json
{
  "event": "approval.approved",
  "deliveredAt": "2026-10-22T10:40:12.511Z",
  "form": { "id": "a1b2…", "slug": "mandantenaufnahme", "title": "Mandantenaufnahme", "version": 3 },
  "submission": {
    "id": "5f0c…",
    "number": 17,
    "status": "approved",
    "submittedAt": "2026-10-22T09:12:03.120Z",
    "answers": { "name": { "first": "Erika", "last": "Mustermann" }, "email": "erika@beispiel.de" },
    "tags": []
  }
}
```

- `event` ist der Auslöser der Automation: `submission.created`, `submission.status_changed`, `approval.approved` oder `approval.rejected`.
- `answers` hat denselben Aufbau wie in der API (Rohwerte nach Feldschlüssel, leere Felder fehlen). Dateien und Unterschriften stehen dort nur als Verweis; den Inhalt holen Sie über `GET /api/v1/files/{id}`.
- `form.version` ist die Version, mit der die Antwort abgesendet wurde.
- Testläufe tragen zusätzlich `"test": true`.

| Kopfzeile | Inhalt |
|---|---|
| `X-Plica-Signature` | `t=<Unix-Zeit>,v1=<hex(HMAC-SHA256(Geheimnis, t + "." + Body))>` |
| `X-Plica-Delivery` | Zustell-ID, **bei automatischen Wiederholungen gleich** – zum Deduplizieren |
| `X-Plica-Event` | Auslöser wie `event` |
| `X-Plica-Test` | `1` bei Testläufen |
| `User-Agent` | `PLICA-Webhook/1` |

### Das Webhook-Geheimnis

Unter **Einstellungen → API und Webhooks → Webhook-Signatur** zeigt **Anzeigen** das Geheimnis, **Kopieren** übernimmt es. **Neu erzeugen** ersetzt es sofort; alle Empfänger müssen das neue übernehmen, sonst lehnen sie Webhooks ab. Anzeigen und Erneuern werden protokolliert. Die Seite enthält unter **Signatur prüfen (Node.js)** außerdem ein kurzes Prüfbeispiel.

### Signatur prüfen

Prüfen Sie jeden Webhook, bevor Sie Daten übernehmen:

1. Signatur über den **unveränderten** Body berechnen – vor jedem JSON-Parsen. Schon ein umformatiertes Leerzeichen ergibt eine andere Signatur.
2. Mit einem zeitkonstanten Vergleich prüfen.
3. Zeitstempel älter als fünf Minuten ablehnen (Schutz vor Wiederholung abgefangener Nachrichten).

**Node.js:**

```js
import { createHmac, timingSafeEqual } from "node:crypto";

// rawBody: unveränderter Body als String, header: Wert von X-Plica-Signature
export function verifyPlica(rawBody, header, secret, toleranceSec = 300) {
  const p = Object.fromEntries(String(header ?? "").split(",").map((x) => x.split("=", 2)));
  const t = Number(p.t);
  if (!Number.isFinite(t) || !p.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${p.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

**Python:**

```python
import hashlib, hmac, time

def verify_plica(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    parts = dict(p.split("=", 1) for p in header.split(",") if "=" in p)
    try:
        t = int(parts["t"])
    except (KeyError, ValueError):
        return False
    if "v1" not in parts or abs(time.time() - t) > tolerance:
        return False
    expected = hmac.new(secret.encode(), parts["t"].encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, parts["v1"])
```

Antworten Sie bei falscher Signatur mit `401`. PLICA wertet das als endgültige Ablehnung und versucht es nicht erneut.

### Zustellung und Wiederholung

- **Erfolg** ist jede Antwort mit Status 2xx.
- **Zeitlimit 10 Sekunden.** Antwortet das Ziel langsamer, gilt der Versuch als gescheitert – auch wenn Ihr System die Daten verarbeitet hat. Bestätigen Sie deshalb sofort mit `2xx` und verarbeiten Sie danach.
- **Automatische Wiederholung** bei Netzfehlern, Zeitüberschreitung, `429` und `5xx`: mit wachsenden Abständen von 30 Sekunden bis 6 Stunden, insgesamt bis zu 12 Versuche über rund 15 Stunden. Alle Versuche tragen dieselbe `X-Plica-Delivery`.
- **Andere 4xx-Antworten** gelten als endgültige Ablehnung und werden nicht wiederholt. Der Lauf erscheint als fehlgeschlagen und lässt sich nach einer Korrektur erneut anstoßen ([Kapitel 8](08-automationen.md#fehlgeschlagene-zustellungen-erneut-versuchen)). Ein solcher Neustart ist ein neuer Lauf mit **neuer** Zustell-ID.
- **Mindestens einmal.** Ihr Empfänger kann dieselbe Nachricht mehrfach erhalten, etwa wenn das Zeitlimit knapp überschritten wurde oder der Worker genau zwischen Zustellung und Protokollierung abbricht. Speichern Sie `X-Plica-Delivery` und verarbeiten Sie jede ID nur einmal. Weil ein manueller Neustart eine neue ID erzeugt, sollte Ihr System zusätzlich prüfen, ob es zu `submission.id` und `event` schon einen Datensatz angelegt hat.
- **Weiterleitungen** folgt PLICA bis zu dreimal und prüft jedes Ziel erneut. Bei `301`, `302` und `303` wird daraus wie im Browser ein `GET` ohne Body. Tragen Sie deshalb immer die endgültige Adresse ein.
- Jeder Versuch steht mit Ergebnis und HTTP-Status im **Protokoll** der Automation.

### Schutz vor internen Zielen (SSRF)

Damit ein Webhook nicht als Hintertür ins interne Netz dient, löst PLICA den Zielnamen selbst auf und verbindet sich nur mit der geprüften Adresse (kein Umleiten per DNS zwischen Prüfung und Verbindung). Ohne Freigabe gesperrt sind:

- Loopback, private Netze, Link-Local (u. a. `169.254.169.254`), Carrier-NAT, Multicast, Dokumentations- und reservierte Bereiche sowie IPv6-ULA,
- IPv4-in-IPv6-Varianten dieser Adressen,
- Hostnamen, die auf eine dieser Adressen zeigen.

Immer gesperrt sind – auch mit Freigabe –:

- andere Protokolle als `http` und `https`,
- Ports unter 1024 außer 80 und 443,
- Adressen mit Zugangsdaten (`https://nutzer:passwort@…`).

Soll ein System im eigenen LAN beliefert werden, etwa ein Empfangsdienst neben j-lawyer, setzt der Betreiber bewusst `WEBHOOK_ALLOW_PRIVATE=true` ([Kapitel 21](21-konfiguration.md)). Das erlaubt interne Ziele für **alle** Automationen des Servers; wer Automationen anlegen darf (ab Bearbeiter), kann dann auch interne Adressen ansprechen.

## Beispiel: Mandantenaufnahme an j-lawyer im LAN

Ausgangslage wie in [Kapitel 8](08-automationen.md#beispiel-mandantenaufnahme-mit-freigabe-und-übergabe-an-j-lawyer): Nach der Freigabe durch die Anwältin sendet die Automation „Übergabe an j-lawyer“ einen Webhook an `http://192.168.10.5:8090/plica`. PLICA ändert j-lawyer nicht; dazwischen sitzt ein kleiner Empfangsdienst, den Ihre IT betreibt.

Voraussetzungen:

- `WEBHOOK_ALLOW_PRIVATE=true` auf dem PLICA-Server,
- ein API-Schlüssel mit **Lesen und schreiben**, angelegt von einer Person mit mindestens der Rolle Prüfer,
- das Webhook-Geheimnis aus **Einstellungen → API und Webhooks**.

```js
// plica-empfang.mjs – Node.js 20 oder neuer, ohne weitere Pakete
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.PLICA_WEBHOOK_SECRET; // Webhook-Geheimnis
const API = process.env.PLICA_API;               // z. B. https://plica.kanzlei.local/api/v1
const TOKEN = process.env.PLICA_TOKEN;           // plc_… mit „Lesen und schreiben“
const erledigt = new Set();                      // im Betrieb: Datenbanktabelle mit eindeutiger Spalte

function verifyPlica(rawBody, header, secret, toleranceSec = 300) {
  const p = Object.fromEntries(String(header ?? "").split(",").map((x) => x.split("=", 2)));
  const t = Number(p.t);
  if (!Number.isFinite(t) || !p.v1 || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${p.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(p.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

http
  .createServer((req, res) => {
    if (req.method !== "POST") return res.writeHead(405).end();
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!verifyPlica(raw, req.headers["x-plica-signature"], SECRET)) return res.writeHead(401).end();
      res.writeHead(200).end(); // sofort bestätigen, danach verarbeiten

      const delivery = String(req.headers["x-plica-delivery"]);
      const msg = JSON.parse(raw);
      const key = `${msg.submission.id}:${msg.event}`;
      if (msg.test || erledigt.has(delivery) || erledigt.has(key)) return;
      erledigt.add(delivery).add(key);
      uebernehmen(msg).catch((e) => console.error("Übernahme fehlgeschlagen:", e.message));
    });
  })
  .listen(8090);

async function uebernehmen({ event, submission }) {
  if (event !== "approval.approved") return;
  const auth = { authorization: `Bearer ${TOKEN}` };

  // 1. Aufnahmebogen als PDF holen
  const pdf = Buffer.from(await (await fetch(`${API}/submissions/${submission.id}/pdf`, { headers: auth })).arrayBuffer());

  // 2. In j-lawyer Kontakt und Akte anlegen und das PDF ablegen –
  //    hier rufen Sie die REST-API Ihrer j-lawyer-Installation auf.
  await anlegenInJLawyer(submission.answers, pdf);

  // 3. In PLICA zurückmelden (tags ersetzt die Liste, daher die bisherigen mitsenden)
  await fetch(`${API}/submissions/${submission.id}`, {
    method: "PATCH",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ status: "done", tags: [...new Set([...submission.tags, "akte-angelegt"])] }),
  });
}
```

Danach steht die Antwort in PLICA auf Erledigt mit dem Tag `akte-angelegt`, und der Verlauf zeigt jeden Schritt. Die Kollisionsprüfung und die Annahmeentscheidung bleiben bei der Anwältin – genau dafür steht die Freigabe vor dem Webhook.

## Ideen für die Anbindung eigener Systeme

PLICA ändert diese Anwendungen nicht. Die folgenden Wege nutzen nur die oben beschriebenen Schnittstellen.

- **Kurzlinks:** Die öffentliche Adresse eines Formulars (`publicUrl` aus `GET /forms/{id}`) in einem Kurzlink-Dienst hinterlegen und den merkbaren Kurzlink auf Flyern verwenden. Zieht das Formular um, ändern Sie nur das Ziel des Kurzlinks.
- **Gestaltete QR-Codes:** Aus `publicUrl` mit einem QR-Code-Generator einen druckfertigen Code erzeugen, etwa für Aushänge zur Veranstaltungsanmeldung. Für einfache Fälle genügt der QR-Code im Reiter **Teilen**.
- **Tabellen und Auswertungen:** Ein nächtliches Skript holt mit `since` und `nextCursor` alle neuen Antworten und schreibt sie in eine Datenbank oder Tabelle.

← [Automationen](08-automationen.md) · [Inhaltsverzeichnis](README.md)
