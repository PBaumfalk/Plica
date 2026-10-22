# Integrationen: REST-API und Webhooks

PLICA bietet zwei Wege, andere Systeme anzubinden:

- **REST-API** (abrufen): Ein anderes System fragt Formulare und Antworten ab und kann Status und Kennzeichnungen setzen.
- **Webhooks** (zustellen): PLICA meldet ein Ereignis sofort per signiertem `POST` an ein anderes System.

Beide arbeiten immer innerhalb **eines** Workspace.

## REST-API

### Schlüssel anlegen

Unter **Einstellungen → API und Webhooks → Neuer Schlüssel**. Dafür sind die Rollen Administrator oder Inhaber nötig.

- **Rechte:** *Nur lesen* oder *Lesen und schreiben*. Die wirksamen Rechte sind immer die Schnittmenge aus Schlüssel und aktueller Rolle des Besitzers. Verliert der Besitzer die Rolle oder verlässt er den Workspace, verliert der Schlüssel sofort seine Wirkung.
- **Gültigkeit:** 30 Tage, 90 Tage, 1 Jahr oder unbegrenzt. Ein Widerruf wirkt sofort.
- Der Schlüssel (`plc_…`) wird **nur einmal** angezeigt. PLICA speichert nur einen SHA-256-Hash.

### Aufrufe

```bash
curl -H "Authorization: Bearer plc_…" https://plica.example.de/api/v1/forms
```

| Methode | Pfad | Zweck | Mindestrecht |
|---|---|---|---|
| GET | `/api/v1/forms` | Formulare des Workspace | lesen |
| GET | `/api/v1/forms/{id}` | Formular mit veröffentlichter Definition | lesen |
| GET | `/api/v1/forms/{id}/submissions` | Antworten, älteste zuerst; `since`, `status`, `limit` (≤ 200), `cursor` | lesen |
| GET | `/api/v1/submissions/{id}` | Eine Antwort mit Dateiliste | lesen |
| PATCH | `/api/v1/submissions/{id}` | `status` und/oder `tags` ändern | schreiben + Rolle Prüfer |
| GET | `/api/v1/submissions/{id}/pdf` | Antwort als PDF | lesen |
| GET | `/api/v1/files/{id}` | Upload, Unterschrift oder erzeugtes PDF | lesen |

Die maschinenlesbare Beschreibung liegt unter `/api/v1/openapi.json` (OpenAPI 3.1). Ein automatischer Test stellt sicher, dass jede API-Route dort dokumentiert ist.

**Antworten** liefern die Werte nach **Feldschlüssel** (`answers`), also unabhängig von Beschriftungen. Unter `display` stehen zusätzlich lesbare Texte. Die Feldschlüssel einer Antwort richten sich nach der Formularversion, mit der sie abgesendet wurde (`formVersion`).

**Synchronisieren:** Mit `since=<ISO-Zeitpunkt>` beginnen und dann `nextCursor` folgen, bis er `null` ist.

**Status ändern** per `PATCH` löst Automationen mit dem Auslöser „Status geändert“ aus, genau wie eine Änderung in der Oberfläche. Unbekannte Felder im Body werden abgelehnt.

**Dateien in Quarantäne:** Ungeprüfte Uploads (kein Virenscanner konfiguriert) liefern `423 file_quarantined`, bis eine berechtigte Person sie in PLICA freigibt. Als schädlich erkannte Dateien liefern `410`. Jede Datei hat den Header `x-plica-sha256`.

### Fehler und Grenzen

Fehler haben immer die Form `{ "error": { "code": "…", "message": "…" } }`:

| Code | Bedeutung |
|---|---|
| 400 `invalid_request`, `invalid_json`, `invalid_cursor` | Anfrage fehlerhaft |
| 401 `unauthorized` | Schlüssel fehlt, ist ungültig, abgelaufen oder widerrufen |
| 403 `insufficient_scope`, `forbidden` | Schlüssel darf nur lesen bzw. Rolle reicht nicht |
| 404 `not_found` | Nicht vorhanden **oder** in einem anderen Workspace (bewusst nicht unterscheidbar) |
| 429 `rate_limited` | Mehr als 600 Anfragen pro Minute und Schlüssel; Header `retry-after` |

## Webhooks

Webhooks richtest du in einem Formular unter **Automationen → Schritt „Webhook auslösen“** ein.

### Was gesendet wird

`POST` mit `Content-Type: application/json`:

```json
{
  "event": "submission.created",
  "deliveredAt": "2026-10-22T09:12:03.120Z",
  "form": { "id": "…", "slug": "mandantenaufnahme", "title": "Mandantenaufnahme", "version": 3 },
  "submission": {
    "id": "…", "number": 17, "status": "new", "submittedAt": "…",
    "answers": { "name": { "first": "Erika", "last": "Mustermann" }, "email": "erika@beispiel.de" },
    "tags": []
  }
}
```

`event` ist einer der Auslöser: `submission.created`, `submission.status_changed`, `approval.approved` oder `approval.rejected`.

| Kopfzeile | Inhalt |
|---|---|
| `X-Plica-Signature` | `t=<Unix-Zeit>,v1=<hex(HMAC-SHA256(Geheimnis, t + "." + Body))>` |
| `X-Plica-Delivery` | Zustell-ID, **bei Wiederholungen gleich** – zum Deduplizieren |
| `X-Plica-Event` | Auslöser wie oben |

### Signatur prüfen

Das Geheimnis findest du unter **Einstellungen → API und Webhooks** (anzeigen oder neu erzeugen). Prüfe die Signatur immer über den **unveränderten** Body und lehne alte Zeitstempel ab:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPlica(rawBody, header, secret) {
  const p = Object.fromEntries(header.split(",").map((x) => x.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(p.t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${p.t}.${rawBody}`).digest("hex");
  return expected.length === p.v1?.length && timingSafeEqual(Buffer.from(expected), Buffer.from(p.v1));
}
```

### Zustellung und Wiederholung

- **Erfolg** ist jede Antwort mit Status 2xx.
- Bei **Netzfehlern, Zeitüberschreitung (10 s), 429 und 5xx** versucht PLICA es erneut: mit wachsenden Abständen von 30 Sekunden bis 6 Stunden und zufälliger Streuung, insgesamt bis zu 12 Versuche über etwa 16 Stunden. Danach gilt die Zustellung als fehlgeschlagen.
- Andere 4xx-Antworten gelten als endgültige Ablehnung und werden nicht automatisch wiederholt. Der Lauf erscheint als fehlgeschlagen und lässt sich nach einer Korrektur im Reiter „Automationen“ mit „Erneut ausführen“ neu anstoßen.
- Die Zustellung erfolgt **mindestens einmal**. Stürzt der Worker genau zwischen Zustellung und Protokollierung ab, kann ein Webhook doppelt ankommen. Dedupliziere deshalb über `X-Plica-Delivery`.
- Weiterleitungen werden bis zu dreimal verfolgt, jedes Ziel wird erneut geprüft. Antworten über 256 KB werden abgeschnitten.
- Jeder Versuch steht mit Ergebnis im **Protokoll** der Automation.
- **Testläufe** („Mit letzter Antwort testen“) tragen im Body `"test": true` und den Header `X-Plica-Test: 1`; E-Mails beginnen mit „[Test]“. Legen Sie für Testläufe keine echten Datensätze an.

### Schutz vor internen Zielen (SSRF)

PLICA löst den Zielnamen selbst auf und verbindet sich nur mit der geprüften Adresse. Folgende Ziele sind gesperrt:

- Loopback, private Netze, Link-Local (u. a. `169.254.169.254`), Carrier-NAT, Multicast und IPv6-ULA
- IPv4-in-IPv6-Varianten dieser Adressen
- Ports unter 1024 außer 80 und 443
- Adressen mit Zugangsdaten

Soll ein System im eigenen LAN beliefert werden, etwa eine Kanzleisoftware auf demselben Server, setzt der Betreiber bewusst `WEBHOOK_ALLOW_PRIVATE=true`.

### Zustellgarantie und Zeitlimit

- **Mindestens einmal**: PLICA wiederholt eine Zustellung bei Netzwerkfehlern, Zeitüberschreitung, HTTP 429 und 5xx – mit wachsenden Abständen (30 Sekunden bis 6 Stunden, insgesamt etwa 16 Stunden). Ihr Empfänger kann dieselbe Nachricht daher mehrfach erhalten. Alle Versuche tragen dieselbe Kennung `X-Plica-Delivery`; speichern Sie sie und verarbeiten Sie jede Kennung nur einmal.
- **Zeitlimit 10 Sekunden**: Antwortet Ihr Ziel langsamer, gilt der Versuch als gescheitert – auch wenn Ihr System die Daten verarbeitet hat. Bestätigen Sie deshalb sofort mit `2xx` und verarbeiten Sie asynchron.
- **Endgültig gescheitert**: Nach dem letzten Versuch erscheint die Zustellung in PLICA als „fehlgeschlagen“ (Formularliste und Reiter „Automationen“) und lässt sich dort erneut anstoßen. Bereits erledigte Schritte derselben Automation werden dabei nicht wiederholt.

## Ideen für die Anbindung eigener Systeme

PLICA ändert diese Anwendungen nicht. Die folgenden Wege nutzen nur die oben beschriebenen Schnittstellen.

- **j-lawyer:** Ein kleiner Dienst empfängt den Webhook der Mandantenaufnahme, prüft die Signatur und legt über die j-lawyer-API einen Kontakt und eine Akte an, mit dem PDF der Antwort (`GET /submissions/{id}/pdf`) als Dokument. Danach setzt er per `PATCH` den Status `done` und die Kennzeichnung `akte-angelegt`. Kollisionsprüfung und Annahme bleiben eine menschliche Entscheidung, etwa über den Schritt „Freigabe anfordern“ vor dem Webhook.
- **Filum (Kurzlinks):** Die öffentliche Adresse eines Formulars (`publicUrl` aus `GET /forms/{id}`) als gut merkbaren Kurzlink auf Flyern verwenden. Zieht das Formular um, ändert man nur das Ziel in Filum.
- **Tessera (QR-Codes):** Aus `publicUrl` einen druckfertigen QR-Code mit Lesbarkeitsprüfung erzeugen, etwa für Aushänge zur Veranstaltungsanmeldung.

← [Automationen](08-automationen.md) · [Inhaltsverzeichnis](README.md)
