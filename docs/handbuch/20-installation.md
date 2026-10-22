# 20 · Installation

PLICA läuft als Docker-Compose-Anwendung auf einem Linux-Server (getestet mit Docker Engine 29, Compose v2). Für eine Kanzlei mit einigen hundert Antworten im Monat genügen 2 vCPU, 4 GB RAM und 20 GB SSD; mit Virenscanner (ClamAV) zusätzlich 3 GB RAM.

## Dienste

| Dienst | Aufgabe | Erreichbar |
|---|---|---|
| `app` | Oberfläche, öffentliche Formulare, API | `${PLICA_BIND}:${PLICA_PORT}` (Standard `127.0.0.1:3000`) |
| `worker` | E-Mails, Webhooks, Workflows, Aufbewahrungsfristen | nur ausgehend |
| `migrate` | führt beim Start Datenbankmigrationen aus und beendet sich | – |
| `db` | PostgreSQL 18 | nur internes Netz |
| `storage` | S3-kompatibler Objektspeicher (RustFS) für Uploads, Unterschriften, PDFs | nur internes Netz |
| `clamav` | optionaler Virenscanner (`--profile clamav`) | nur internes Netz |

Datenbank und Speicher hängen in einem Docker-Netz ohne Internetzugang (`internal: true`) und haben keine Host-Ports.

## Schritte

```bash
git clone <repository> /opt/plica && cd /opt/plica
cp .env.example .env
nano .env    # APP_URL, SECRET_KEY, POSTGRES_PASSWORD, S3_ROOT_PASSWORD, SMTP_URL setzen
docker compose up -d --build
docker compose ps                       # app: healthy
docker compose logs app | grep Einrichtungscode
```

Geheimnisse erzeugen Sie mit `openssl rand -hex 32`. Fehlt ein Pflichtwert, bricht `docker compose` mit einer Meldung wie `POSTGRES_PASSWORD fehlt in .env` ab.

## Ersteinrichtung

PLICA kennt kein Standardpasswort. Solange kein Konto existiert, schreibt die App beim Start einen **Einrichtungscode** ins Log. Unter `https://ihre-domain/einrichten` geben Sie den Code ein, legen das Inhaberkonto an und benennen den ersten Workspace. Danach ist der Code verbraucht und `/einrichten` gesperrt. Den Code zeigt auch `docker compose exec app plica setup-code`.

## Mit Virenscanner

```bash
echo "CLAMAV_HOST=clamav" >> .env
docker compose --profile clamav up -d
```

ClamAV lädt beim ersten Start seine Signaturen (einige Minuten). Ohne Scanner nimmt PLICA Uploads an, markiert sie aber als **ungeprüft**. Berechtigte Personen sehen einen Warnhinweis und müssen die Datei vor dem Öffnen bewusst freigeben.

## Eigenes Image aus einer Registry

Setzen Sie `PLICA_IMAGE=ghcr.io/<organisation>/plica:<version>` in `.env` und starten Sie mit `docker compose pull && docker compose up -d` (ohne `--build`).

← [Handbuch](README.md) · weiter: [Konfiguration](21-konfiguration.md) →
