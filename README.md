# PLICA

**Formulare für die Kanzlei – gebaut, veröffentlicht und ausgewertet auf dem eigenen Server.**

PLICA ist eine selbst gehostete Formularplattform. Sie bauen Formulare in einem visuellen Editor, veröffentlichen sie unter einer eigenen Adresse und bearbeiten die Antworten an einem Ort: mit Status, Notizen, Freigaben, Export und PDF. Mandantinnen und Mandanten füllen die Formulare ohne Konto aus; die Daten verlassen Ihren Server nicht.

*Plica* ist lateinisch für **Falz** – die Linie, an der ein Blatt umgeschlagen wird. Im Editor ist genau das ein Seitenumbruch.

## Was PLICA kann

**Formulare bauen**
- 30 Feldtypen, von Name und Adresse über Betrag, Datum und Matrix bis Datei-Upload und Unterschrift
- Bedingte Logik und Berechnungen ohne Programmierung, mit Prüfung auf Widersprüche
- Drei Darstellungen: klassisch, eine Frage pro Karte oder Assistent mit Schritten
- Vorlagen, Bausteine, Versionen, Rückgängig und Vorschau; Autosave mit Konfliktschutz

**Veröffentlichen**
- Link, QR-Code oder Einbettung in die Kanzlei-Website
- Passwortschutz, Antwortlimit, Zeitfenster, Fortsetzen-Link und Folgeformulare
- Eigene Domain nur für Formulare, die Verwaltung bleibt intern

**Antworten bearbeiten**
- Tabelle mit Ansichten, Filtern und Tastaturbedienung; Detailansicht mit Notizen, Tags und Verlauf
- Export als CSV, XLSX oder JSON; PDF nach eigener Vorlage
- Uploads mit Inhaltsprüfung, Virenscan (ClamAV) oder Quarantäne

**Automatisieren**
- E-Mails an Kanzlei und Absender, signierte Webhooks (z. B. an j-lawyer), Freigaben durch eine Rolle
- Dauerhafte Warteschlange: Nach einem Absturz läuft jeder Schritt genau einmal weiter
- REST-API mit OpenAPI-Beschreibung

**Team und Sicherheit**
- Workspaces, fünf Rollen von Leser bis Inhaber, Einladungen und Protokoll
- Anmeldung mit Passwort und Zwei-Faktor oder über **authentik (OIDC)** mit Rollen aus Gruppen
- Abgleich mit OWASP ASVS 5.0, Aufbewahrungsfristen mit endgültiger Löschung

## Handbuch

Das [Handbuch](docs/handbuch/README.md) erklärt die Arbeit mit PLICA (Teil A), die Administration (Teil B) und den Betrieb (Teil C). Dazu: [Sicherheit (ASVS)](docs/sicherheit/asvs.md), [Datenschutz](docs/datenschutz.md), [Integrationen und API](docs/handbuch/integrationen.md).

## Schnellstart: Produktion

Voraussetzungen: Linux-Server mit Docker Engine 24+ und Compose v2, eine Domain und ein Reverse Proxy mit TLS (siehe [Reverse Proxy](docs/handbuch/22-reverse-proxy.md)).

```bash
git clone https://github.com/PBaumfalk/Plica.git plica && cd plica
cp .env.example .env            # Werte ersetzen; Schlüssel z. B. mit: openssl rand -hex 32
docker compose up -d --build    # App, Worker, Datenbank und Speicher
docker compose logs app | grep Einrichtungscode
```

Öffnen Sie `https://ihre-domain/einrichten`, geben Sie den Einrichtungscode ein und legen Sie das Inhaberkonto an. Der App-Port ist nur auf `127.0.0.1:3000` gebunden; der Reverse Proxy leitet die Domain dorthin. Mit Virenscanner: `docker compose --profile clamav up -d`.

Anmeldung über authentik, E-Mail-Versand und alle weiteren Einstellungen: [Konfiguration](docs/handbuch/21-konfiguration.md). Sicherung: `docker compose exec app plica backup` – siehe [Sicherung und Wiederherstellung](docs/handbuch/23-sicherung.md).

## Schnellstart: Entwicklung

```bash
pnpm install
pnpm dev:init       # lokale Dev-Konfiguration anlegen (einmalig)
pnpm dev:services   # PostgreSQL, S3-Speicher und Mailpit auf 127.0.0.1:47xx
pnpm db:migrate
pnpm dev            # http://localhost:4700 – Einrichtungscode steht im Terminal
pnpm worker         # zweites Terminal: E-Mails, Webhooks, Automationen
```

Mailpit zeigt alle versendeten E-Mails unter <http://localhost:4780>.

Tests: `pnpm test` (Unit und Integration), `pnpm test:e2e` (Browser, Produktions-Build), `scripts/docker-lifecycle-test.sh` (Image, Sicherung und Wiederherstellung). Siehe [Tests](docs/handbuch/27-tests.md).

## Technik in Kürze

Next.js 16 mit React 19 und TypeScript, PostgreSQL 18 über Drizzle, S3-kompatibler Speicher (RustFS), ein Worker-Prozess mit Warteschlange in PostgreSQL. Ein Image für App, Worker und Kommandozeile; Datenbank und Speicher liegen im internen Docker-Netz; Konfiguration ausschließlich über Umgebungsvariablen. Mehr in [Architektur](docs/handbuch/26-architektur.md).

## Lizenz

MIT
