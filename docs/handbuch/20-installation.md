# 20 · Installation

Dieses Kapitel führt die IT vom leeren Server bis zum ersten Inhaberkonto. PLICA läuft als Docker-Compose-Anwendung; alle Dienste stehen in [`compose.yml`](../../compose.yml), das Image baut das [`Dockerfile`](../../Dockerfile).

## Voraussetzungen

- Linux-Server mit Docker Engine und dem Compose-Plugin (v2.24 oder neuer – `compose.yml` nutzt `env_file` mit `required`).
- Ein DNS-Name für PLICA, z. B. `plica.example.de`, und ein Reverse Proxy für TLS (siehe [Reverse Proxy](22-reverse-proxy.md)).
- Optional ein SMTP-Zugang für Einladungen, Benachrichtigungen und E-Mail-Automationen.
- Internetzugang beim Bauen des Images (Node-Pakete, PostgreSQL-Client aus dem Paketarchiv von postgresql.org).

**Ressourcen.** Die Speichergrenzen in `compose.yml` summieren sich auf rund 3 GB (App 768 MB, Worker 512 MB, Datenbank 1 GB, Objektspeicher 512 MB). Als Richtwert für eine Kanzlei genügen 2 vCPU, 4 GB RAM und 20 GB SSD. Mit Virenscanner kommen bis zu 3 GB RAM hinzu. Wachsen wird vor allem der Objektspeicher (Uploads, Unterschriften, PDFs) und das Sicherungsverzeichnis.

## Die Dienste

| Dienst | Aufgabe | Netz | Erreichbar |
|---|---|---|---|
| `migrate` | führt beim Start die Datenbankmigrationen aus und beendet sich | `internal` | – |
| `app` | Oberfläche, öffentliche Formulare, API | `internal`, `web` | Host-Port `${PLICA_BIND}:${PLICA_PORT}`, Standard `127.0.0.1:3000` |
| `worker` | Automationen (E-Mails, Webhooks, Freigaben), Benachrichtigungen, tägliche Bereinigung, Nachprüfung ungeprüfter Uploads | `internal`, `web` | nur ausgehend |
| `db` | PostgreSQL 18 | `internal` | nein |
| `storage` | S3-kompatibler Objektspeicher (RustFS) | `internal` | nein |
| `clamav` | optionaler Virenscanner (Profil `clamav`) | `internal` | nein |

Das Netz `internal` hat keinen Internetzugang (`internal: true`). Datenbank, Speicher und Virenscanner haben keine Host-Ports. `app`, `worker` und `migrate` laufen aus demselben Image.

Die Container sind gehärtet: schreibgeschütztes Dateisystem, keine Linux-Capabilities, `no-new-privileges`, Speicher- und Prozessgrenzen, Log-Rotation (5 × 10 MB). Die App läuft als Benutzer `node`.

**Startreihenfolge:** `db` wird gesund → `migrate` läuft durch → `app` und `worker` starten, sobald auch `storage` gesund ist. Schlägt die Migration fehl, starten App und Worker nicht.

**Volumes:** `db` (Datenbank), `files` (Objektspeicher), `backups` (Sicherungen, in App und Worker unter `/backups`), `clamav` (Virensignaturen).

## Schritt für Schritt

### 1. Code holen

```bash
git clone <repository> /opt/plica
cd /opt/plica
```

### 2. Variablendatei anlegen

```bash
cp .env.example .env
chmod 600 .env
```

Erzeugen Sie für jedes Geheimnis einen eigenen Zufallswert:

```bash
openssl rand -hex 32
```

Tragen Sie mindestens ein:

```
APP_URL=https://plica.example.de
SECRET_KEY=<64 Hex-Zeichen>
POSTGRES_PASSWORD=<Zufallswert>
S3_ROOT_USER=plica
S3_ROOT_PASSWORD=<Zufallswert>
TRUST_PROXY=true
```

Für E-Mail-Versand zusätzlich `SMTP_URL` und `MAIL_FROM`. Alle Variablen erklärt [Konfiguration](21-konfiguration.md).

Wichtig:

- `SECRET_KEY` nach der Inbetriebnahme **nie mehr ändern** und getrennt vom Server sichern. Ohne ihn sind Zwei-Faktor-Geheimnisse, Zwischenstände und Webhook-Geheimnisse nicht mehr lesbar.
- `DATABASE_URL` und die `S3_*`-Zugangsdaten der App setzt `compose.yml` selbst aus `POSTGRES_*` und `S3_ROOT_*`. Eigene Werte in `.env` werden dafür überschrieben.
- Fehlt ein Pflichtwert, bricht `docker compose` sofort ab, z. B. mit `POSTGRES_PASSWORD fehlt in .env`.

### 3. Bauen und starten

```bash
docker compose up -d --build
docker compose ps -a
```

Der erste Build dauert einige Minuten. Danach sollten `db`, `storage` und `app` als `healthy` erscheinen, `worker` als laufend (ohne eigene Gesundheitsprüfung) und `migrate` als beendet mit `Exited (0)`. Die Gesundheitsprüfung der App fragt intern `/healthz` ab (Datenbank und Speicher):

```bash
docker compose exec app plica health
```

### 4. Reverse Proxy einrichten

Richten Sie jetzt TLS und den Proxy ein (siehe [Reverse Proxy](22-reverse-proxy.md)), damit `APP_URL` im Browser erreichbar ist. Die Ersteinrichtung sollte bereits über die endgültige Adresse laufen.

## Ersteinrichtung

PLICA hat kein Standardpasswort. Solange noch kein Konto existiert, schreibt die App beim Start einen **Einrichtungscode** (drei Blöcke à vier Ziffern) ins Log:

```bash
docker compose logs app | grep Einrichtungscode
```

Alternativ:

```bash
docker compose exec app plica setup-code
```

Dann:

1. `https://plica.example.de/einrichten` öffnen (vor der Einrichtung leitet auch `/login` dorthin).
2. **Einrichtungscode** eingeben.
3. **Dein Konto**: Name, E-Mail und Passwort (mindestens 10 Zeichen) des Inhabers.
4. **Dein Workspace**: Name des ersten Workspace, z. B. der Kanzleiname.

Sie sind danach angemeldet und Inhaber dieses Workspace. Der Code ist verbraucht, `/einrichten` leitet nur noch zur Anmeldung. Der Code bleibt bis dahin über Neustarts gleich. Wer ihn kennt, kann das erste Konto anlegen – richten Sie PLICA deshalb zügig nach dem ersten Start ein.

Für automatisierte Installationen können Sie einen festen Code über `SETUP_CODE` vorgeben.

Danach:

- **Einstellungen → Konto → Zwei-Faktor-Anmeldung** für das Inhaberkonto einrichten. Es ist auch der Notzugang, falls SSO ausfällt.
- Weitere Personen einladen (siehe [Team und Rollen](10-team-rollen.md)).
- Sicherungen einrichten (siehe [Sicherung und Wiederherstellung](23-sicherung.md)).
- Optional SSO anbinden (siehe [Anmeldung über authentik](21-konfiguration.md#anmeldung-über-authentik-oidc)).

Das Inhaberkonto entsteht immer über den Einrichtungscode. Solange PLICA nicht eingerichtet ist, weist es jede SSO-Anmeldung ab – auch mit `OIDC_AUTO_CREATE_USERS=true`. Sie können SSO also schon vorher konfigurieren; nutzbar ist es erst nach der Ersteinrichtung.

## Mit Virenscanner

Ohne Virenscanner nimmt PLICA Uploads an, hält sie aber als **ungeprüft** in Quarantäne. Berechtigte Personen sehen einen Warnhinweis und müssen eine Datei bewusst freigeben, bevor sie sich öffnen lässt.

Mit ClamAV prüft PLICA jede hochgeladene Datei:

```bash
echo "CLAMAV_HOST=clamav" >> .env
docker compose --profile clamav up -d
```

Hinweise:

- Das Image `clamav/clamav-debian` gibt es für amd64 und arm64. Es braucht bis zu 3 GB RAM.
- Beim ersten Start lädt ClamAV seine Signaturen; das dauert einige Minuten. In dieser Zeit bleiben Uploads ungeprüft.
- Der Worker prüft ungeprüfte Dateien stündlich erneut, sobald der Scanner erreichbar ist.
- `/healthz` meldet den Zustand des Scanners (`virusScanner`), wertet ihn aber nicht als Fehler.
- Geben Sie das Profil bei allen späteren `docker compose`-Befehlen mit an, die alle Dienste betreffen (etwa `up -d` nach einem Update), sonst wird `clamav` nicht mit gestartet.

## Fertiges Image aus einer Registry

Statt auf dem Server zu bauen, können Sie ein Image aus einer Registry verwenden:

```
PLICA_IMAGE=ghcr.io/<organisation>/plica:<version>
```

in `.env` setzen und ohne `--build` starten:

```bash
docker compose pull
docker compose up -d
```

Updates und Rollback beschreibt [Updates und Rollback](24-updates.md).

← [Handbuch](README.md) · weiter: [Konfiguration](21-konfiguration.md) →
