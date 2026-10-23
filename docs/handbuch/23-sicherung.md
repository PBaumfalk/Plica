# 23 · Sicherung und Wiederherstellung

PLICA bringt Sicherung und Wiederherstellung als Befehle der Kommandozeile `plica` mit (Quelltext: `src/cli/backup.ts`). Sie laufen im Container `app`, der dafür den PostgreSQL-18-Client (`pg_dump`, `pg_restore`, `psql`) enthält.

## Was gesichert wird

Eine Sicherung ist **eine** Datei `plica-<art>-<zeitpunkt>.tar.gz`, zum Beispiel `plica-auto-2026-10-23_02-30-00.tar.gz` (Zeitpunkt in UTC). Sie enthält:

- `database.dump`: den vollständigen Datenbankabzug (`pg_dump --format=custom --no-owner --no-privileges`), also alle Formulare, Versionen, Antworten, Konten, Sitzungen, Jobs und das Protokoll,
- `objects/`: alle Objekte aus dem S3-Bucket (`S3_BUCKET`, Standard `plica`) – Uploads, Unterschriften, erzeugte PDFs, Formularbilder,
- `manifest.json`: Erstellungszeitpunkt, App-Version (`PLICA_VERSION`), Größe und SHA-256-Prüfsumme je Bestandteil sowie Schlüssel und Inhaltstyp jedes Objekts.

Die Datei entsteht zunächst als `<name>.tar.gz.tmp`. PLICA prüft sie danach vollständig (Prüfsummen und ein kompletter Lesedurchgang des Abzugs mit `pg_restore`) und benennt sie erst dann um. Ein Abbruch hinterlässt deshalb nie eine scheinbar gültige Sicherung.

Sicherungen enthalten personenbezogene Daten. PLICA legt das Verzeichnis mit den Rechten `0700` und jede Datei mit `0600` an.

### Was nicht in der Sicherung steckt

- **`SECRET_KEY`** aus der Konfigurationsdatei des Servers. Ohne denselben Schlüssel sind nach einer Wiederherstellung TOTP-Geheimnisse, gespeicherte Zwischenstände von Fortsetzungslinks, Webhook-Geheimnisse und die bei SSO-Sitzungen hinterlegten ID-Tokens nicht mehr lesbar. Bewahren Sie die Konfigurationsdatei getrennt von den Sicherungen und geschützt auf (siehe [Konfiguration](21-konfiguration.md)).
- Container-Images. Sie lassen sich über den Git-Stand oder das Image-Tag (`PLICA_IMAGE`) wiederherstellen.
- Die Signaturdatenbank von ClamAV (Volume `clamav`); sie wird beim Start neu geladen.

## Sicherung anlegen

```bash
docker compose exec app plica backup                    # manuelle Sicherung
docker compose exec app plica backups                   # vorhandene Sicherungen auflisten
docker compose exec app plica verify /backups/plica-manuell-2026-10-23_07-36-50.tar.gz
```

`plica backup` meldet „Sicherung erstellt und geprüft: …“. `plica verify` meldet „Sicherung in Ordnung: vom …, Datenbank …, N Dateien.“ oder bricht mit „Sicherung fehlerhaft: …“ ab.

Die Sicherungen liegen im Docker-Volume `backups`, im Container unter `/backups` (`BACKUP_DIR`). Der Arbeitsordner beim Packen liegt ebenfalls dort, nicht im kleinen `/tmp` des Containers. Während einer Sicherung liegen die ungepackten Daten und das Archiv gleichzeitig im Volume; eine Wiederherstellung entpackt die Sicherung und legt zusätzlich eine Sicherheitskopie an. Planen Sie neben den aufbewahrten Sicherungen freien Platz von mindestens dem Doppelten der aktuellen Datenmenge (Datenbank plus Dateien) ein.

### Automatisch per cron auf dem Host

```cron
30 2 * * * cd /opt/plica && docker compose exec -T app plica backup --auto >> /var/log/plica-backup.log 2>&1
```

Mit `--auto` heißt die Datei `plica-auto-…`. Danach löscht PLICA ältere automatische Sicherungen und behält die neuesten `BACKUP_KEEP` (Standard 14). Manuelle Sicherungen (`plica-manuell-…`) und die Sicherungen vor einer Wiederherstellung (`plica-vor-wiederherstellung-…`) löscht PLICA nie. Räumen Sie diese selbst auf.

Die Sicherung ist kein gemeinsamer Schnappschuss von Datenbank und Objektspeicher: Erst entsteht der Abzug, danach werden die Objekte gelesen. Legen Sie den Zeitpunkt deshalb in eine ruhige Zeit. Objekte ohne zugehörigen Datensatz entfernt die tägliche Bereinigung des Workers nach 24 Stunden.

## Externe Kopie (Pflicht des Betreibers)

Eine Sicherung im Volume `backups` liegt auf demselben Server wie die Daten. Sie schützt nicht vor Plattenausfall, Verlust des Servers oder Verschlüsselung durch Schadsoftware. Kopieren Sie die Sicherungen deshalb regelmäßig auf ein anderes System, zum Beispiel direkt nach dem cron-Lauf:

```bash
docker compose cp app:/backups ./plica-backups
```

Für die externe Kopie gilt:

- verschlüsselt übertragen und verschlüsselt ablegen (personenbezogene Daten, Mandatsgeheimnis),
- mindestens eine Kopie außerhalb des Serverstandorts,
- `SECRET_KEY` getrennt davon aufbewahren, aber so, dass er im Notfall verfügbar ist.

PLICA selbst überträgt keine Sicherungen nach außen.

## Wiederherstellen

> Die Wiederherstellung **ersetzt alle aktuellen Daten** in Datenbank und Objektspeicher.

```bash
docker compose stop worker
docker compose exec app plica restore /backups/<datei>.tar.gz --yes
docker compose restart app worker
```

Ohne `--yes` bricht der Befehl mit Exit-Code 2 ab, ohne etwas zu ändern. Die Schalter dürfen vor oder nach dem Dateinamen stehen. Das Anhalten des Workers ist eine Vorsichtsmaßnahme, damit während der Wiederherstellung keine Jobs laufen.

Eine Sicherung von einem anderen System kopieren Sie vorher in das Volume:

```bash
docker compose cp ./plica-auto-2026-10-23_02-30-00.tar.gz app:/backups/
```

### Ablauf und Atomarität

`plica restore` geht in dieser Reihenfolge vor:

1. **Prüfen.** Archiv entpacken, Manifest lesen, alle Prüfsummen vergleichen und den Abzug mit `pg_restore` vollständig lesen. Eine beschädigte Sicherung wird mit „Sicherung fehlerhaft“ abgelehnt, bevor irgendetwas verändert wird.
2. **Speicher erreichbar?** Ist der Objektspeicher nicht erreichbar, bricht der Befehl ab („es wurde nichts verändert“).
3. **Sicherheitskopie.** PLICA sichert den aktuellen Stand automatisch als `plica-vor-wiederherstellung-….tar.gz` und gibt den Dateinamen aus.
4. **Datenbank in einer Transaktion.** Die Schemas `public` und `drizzle` werden gelöscht und der Abzug eingespielt, alles mit `psql --single-transaction` und `ON_ERROR_STOP`. Scheitert ein Schritt, rollt PostgreSQL alles zurück; die bisherigen Daten bleiben unverändert.
5. **Dateien.** Erst werden alle Objekte der Sicherung geschrieben, danach werden Objekte entfernt, die nicht in der Sicherung stehen.

Die Datenbank wird damit atomar ersetzt, der Objektspeicher nicht. Bricht Schritt 5 ab (etwa weil der Speicher ausfällt), ist die Datenbank bereits wiederhergestellt und der Dateibestand unvollständig. Wiederholen Sie dann den Befehl mit derselben Datei; die Sicherheitskopie aus Schritt 3 bleibt erhalten.

Der eingespielte Abzug bringt den Migrationsstand der Sicherung mit. Stammt die Sicherung von einer älteren PLICA-Version, führen Sie nach der Wiederherstellung die Migrationen aus (siehe [Updates](24-updates.md)):

```bash
docker compose run --rm migrate
docker compose restart app worker
```

Beachten Sie den Datenschutz: Eine ältere Sicherung kann Antworten enthalten, die inzwischen nach Aufbewahrungsregeln gelöscht wurden. Antworten mit abgelaufener Frist entfernt die nächste tägliche Bereinigung erneut.

## Wiederherstellungsprobe (Pflicht des Betreibers)

Eine Sicherung gilt erst als brauchbar, wenn sie sich wiederherstellen ließ. `plica verify` prüft Vollständigkeit und Lesbarkeit, ersetzt aber keine Probe. Spielen Sie deshalb regelmäßig (etwa vierteljährlich und nach jedem Update) eine Sicherung aus der **externen** Kopie in eine getrennte Instanz ein und prüfen Sie Stichproben: Anmeldung, einige Antworten, ein Upload, ein PDF.

Eine getrennte Instanz auf demselben Host läuft als eigenes Compose-Projekt mit eigenen Volumes. Verwenden Sie dafür eine eigene Konfigurationsdatei mit demselben `SECRET_KEY`, einem freien `PLICA_PORT`, eigenen Passwörtern für Datenbank und Speicher und **ohne** `SMTP_URL`. Starten Sie den Worker nicht, sonst würde er wartende Jobs aus der Sicherung ausführen und E-Mails oder Webhooks auslösen.

```bash
cd /opt/plica
export PLICA_ENV_FILE=/opt/plica-probe/probe.vars
probe() { docker compose -p plica-probe --env-file "$PLICA_ENV_FILE" -f compose.yml "$@"; }

probe up -d app                      # startet db, storage, migrate und app – keinen Worker
probe cp ./plica-auto-<zeitpunkt>.tar.gz app:/backups/
probe exec app plica restore /backups/plica-auto-<zeitpunkt>.tar.gz --yes
probe restart app
# … im Browser unter http://127.0.0.1:<PLICA_PORT> prüfen …
probe down -v                        # Probe-Instanz samt ihrer Volumes entfernen
```

Jeder Aufruf braucht die Probe-Konfiguration, weil `compose.yml` Pflichtwerte wie `POSTGRES_PASSWORD` daraus liest. `down -v` löscht die Volumes der Probe-Instanz; prüfen Sie vorher, dass der Projektname `plica-probe` lautet.

Den vollständigen Zyklus prüft auch `scripts/docker-lifecycle-test.sh` mit dem Produktions-Image: Einreichung mit Datei, Sicherung, Löschen von Datenbank und Dateien, Wiederherstellung, Vergleich von Antwort und Datei (siehe [Tests](27-tests.md)). Dieser Test ersetzt die Probe mit Ihren echten Sicherungen nicht.

← [Reverse Proxy](22-reverse-proxy.md) · weiter: [Updates](24-updates.md) →
