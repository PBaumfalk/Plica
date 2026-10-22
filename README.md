# PLICA

**Formulare erstellen, veröffentlichen, auswerten und automatisieren – auf dem eigenen Server.**

PLICA ist eine selbst gehostete Formularplattform für Kanzleien, Unternehmen und Organisationen. Sie bauen Formulare in einem visuellen Editor, zeigen sie wahlweise klassisch, als Karten (eine Frage pro Bildschirm) oder als Assistent mit Schritten, und verwalten die Antworten in einem eigenen Arbeitsbereich mit Status, Notizen, Export und PDF. Uploads werden geprüft und geschützt gespeichert, Automationen versenden E-Mails, rufen signierte Webhooks auf und erzeugen Freigaben.

PLICA braucht kein Cloud-Konto und keine KI. Alles läuft in Docker auf einem Linux-Server.

*Plica* ist lateinisch für **Falz**: die Linie, an der ein Blatt umgeschlagen wird. Im Editor sind Seitenumbrüche genau das.

## 📖 Handbuch

Das [Handbuch](docs/handbuch/README.md) erklärt die Nutzung (Teil A), die Administration (Teil B) und den Betrieb (Teil C). Sicherheit: [ASVS-Abgleich](docs/sicherheit/asvs.md). Datenschutz: [Technik und Betreiberpflichten](docs/datenschutz.md).

## Schnellstart: Produktion (Docker)

Voraussetzungen: Linux-Server mit Docker Engine 24+ und Compose v2, eine Domain, ein Reverse Proxy mit TLS (siehe [Reverse Proxy](docs/handbuch/22-reverse-proxy.md)).

```bash
git clone <repository> plica && cd plica
cp .env.example .env          # Werte mit <…> ersetzen: openssl rand -hex 32
docker compose up -d --build  # baut das Image und startet App, Worker, Datenbank, Speicher
docker compose logs app | grep Einrichtungscode
```

Öffnen Sie dann `https://ihre-domain/einrichten`, geben Sie den Einrichtungscode ein und legen Sie das erste Konto an. Der App-Port ist standardmäßig nur auf `127.0.0.1:3000` gebunden; der Reverse Proxy leitet die Domain dorthin.

Sicherung: `docker compose exec app plica backup` – Details in [Sicherung und Wiederherstellung](docs/handbuch/23-sicherung.md).

## Schnellstart: Entwicklung

```bash
pnpm install
pnpm dev:init       # legt die lokale Dev-Konfiguration an (einmalig)
pnpm dev:services   # Postgres, S3-Speicher und Mailpit auf 127.0.0.1:47xx
pnpm db:migrate
pnpm dev            # http://localhost:4700 – Einrichtungscode steht im Terminal
pnpm worker         # zweites Terminal: E-Mails, Webhooks, Workflows
```

Die Entwicklungsumgebung liest `.env.local`, die `pnpm dev:init` mit lokalen Testzugangsdaten anlegt (siehe [Konfiguration](docs/handbuch/21-konfiguration.md)). Mailpit zeigt alle versendeten E-Mails unter <http://localhost:4780>.

Tests: `pnpm test` (Unit- und Sicherheitstests), `pnpm test:e2e` (Browser-Ende-zu-Ende), `scripts/docker-lifecycle-test.sh` (Produktions-Image komplett). Siehe [Tests](docs/handbuch/27-tests.md).

## Für die IT in einem Satz

Ein Image für App, Worker und Kommandozeile; PostgreSQL 18 und ein S3-kompatibler Speicher im internen Docker-Netz; nur der App-Port wird (lokal) veröffentlicht; Konfiguration ausschließlich über Umgebungsvariablen; Sicherung als eine geprüfte `.tar.gz`-Datei.

## Lizenz

MIT
