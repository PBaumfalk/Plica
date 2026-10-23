# 25 · Betrieb und Kommandozeile

## Kommandozeile `plica`

Im Image liegt das Programm `plica` (`/usr/local/bin/plica`, ruft `dist/cli.mjs` auf; Quelltext `src/cli/main.ts`). Sie rufen es im laufenden App-Container auf:

```bash
docker compose exec app plica <befehl>
```

Für Aufrufe aus Skripten oder cron verwenden Sie `exec -T` (kein Terminal). Ohne Befehl zeigt `plica` die Übersicht; ein unbekannter Befehl oder ein fehlendes Argument beendet es mit Code 1.

| Befehl | Wirkung | Exit-Code |
|---|---|---|
| `plica backup [--auto]` | Sicherung von Datenbank und Dateien anlegen und prüfen; mit `--auto` danach ältere automatische Sicherungen über `BACKUP_KEEP` hinaus löschen | 0 / 1 |
| `plica backups` | Sicherungen in `/backups` auflisten (neueste zuerst, mit Zeitpunkt und Größe) | 0 |
| `plica verify <datei>` | Sicherung vollständig prüfen (Prüfsummen, Lesbarkeit des Abzugs) | 0 / 1 |
| `plica restore <datei> --yes` | Sicherung wiederherstellen; ersetzt alle Daten | 0 / 1; 2 ohne `--yes` |
| `plica setup-code` | Einrichtungscode anzeigen, solange PLICA nicht eingerichtet ist | 0 |
| `plica reset-password <email>` | Zufälliges neues Passwort setzen und alle Sitzungen des Kontos beenden | 0 / 1 |
| `plica health` | `/healthz` der laufenden App abfragen und die Antwort ausgeben | 0 gesund / 1 |

Schalter wie `--yes` dürfen vor oder nach dem Dateinamen stehen. Fehler erscheinen als „Fehler: …“ auf stderr.

### Beispiele

```bash
# Sicherung, Liste, Prüfung, Wiederherstellung – Einzelheiten in Kapitel 23
docker compose exec app plica backup
docker compose exec app plica backups
docker compose exec app plica verify /backups/plica-auto-2026-10-23_02-30-00.tar.gz
docker compose exec app plica restore /backups/plica-auto-2026-10-23_02-30-00.tar.gz --yes

# Ersteinrichtung: Code anzeigen (danach: „PLICA ist bereits eingerichtet.“)
docker compose exec app plica setup-code

# Notzugang: neues Passwort für ein Konto
docker compose exec app plica reset-password anna.beispiel@kanzlei.de

# Gesundheitsprüfung (nutzt auch der Docker-Healthcheck)
docker compose exec app plica health
```

Zu `reset-password`:

- Die E-Mail-Adresse wird ohne Beachtung der Groß- und Kleinschreibung gesucht.
- Das neue Passwort erscheint einmalig im Terminal. Geben Sie es auf sicherem Weg weiter und lassen Sie es nach der Anmeldung ändern.
- Ein aktiviertes TOTP bleibt bestehen; der zweite Faktor wird weiter abgefragt.
- Der Vorgang steht im Protokoll (`password.reset_cli`).
- Der Befehl funktioniert auch für Konten, die bisher nur per SSO angelegt wurden. Er ist damit der Notzugang, wenn der OIDC-Anbieter ausfällt. Ist die Passwort-Anmeldung mit `LOCAL_LOGIN=hidden` ausgeblendet, erreichen Sie sie unter `/login?lokal=1`.

In der Entwicklungsumgebung steht dieselbe Kommandozeile als `pnpm cli <befehl>` zur Verfügung.

## Gesundheitsprüfung `/healthz`

`GET /healthz` prüft die Datenbank (Abfrage auf die Tabelle `users`, also auch das Schema) und den Objektspeicher. Die Antwort ist nie gecacht:

```json
{"status":"ok","database":"ok","storage":"ok","virusScanner":"nicht konfiguriert"}
```

- HTTP 200, wenn Datenbank und Speicher erreichbar sind, sonst HTTP 503 mit `"status":"fehler"` und `"fehler"` beim betroffenen Teil.
- `virusScanner` ist `ok`, `nicht erreichbar` oder `nicht konfiguriert`. Er beeinflusst den Status nicht: Ohne Scanner bleiben Uploads in Quarantäne, die Anwendung ist trotzdem gesund.
- Die Antwort enthält keine Versions- oder Konfigurationsangaben.
- `/healthz` ist auch über die öffentliche Formular-Domain (`PUBLIC_URL`) erreichbar.

Der Docker-Healthcheck des Images ruft `plica health` auf (alle 30 s, Timeout 5 s, Startphase 40 s, 3 Fehlversuche). Der Dienst `worker` hat **keinen** Healthcheck (`healthcheck: disable: true` in `compose.yml`).

## Logs

```bash
docker compose logs -f app worker
docker compose logs --since 24h worker
docker compose logs migrate
```

Alle PLICA-Dienste sowie `db` und `storage` schreiben JSON-Datei-Logs mit Rotation (10 MB × 5 Dateien je Container). Der optionale Dienst `clamav` nutzt die Docker-Voreinstellung.

- Der **Worker** schreibt eine JSON-Zeile je Ereignis, etwa `{"t":"…","worker":"<host>:<pid>","msg":"job","id":42,"type":"workflow.run","attempt":1,"outcome":"done"}`. `outcome` ist `done`, `retry`, `failed` oder `dead`.
- Die **App** schreibt Fehler als `[bereich] {"name":…,"message":…,"code":…}`. Datenbankfehler werden ohne Abfrageparameter protokolliert, damit keine Antwortinhalte ins Log gelangen.
- PLICA schreibt keine Passwörter, Tokens oder Antwortinhalte ins Log.

## Worker

Der Worker (`src/worker/main.ts`, eigener Container mit demselben Image) arbeitet die dauerhafte Job-Queue in PostgreSQL (Tabelle `jobs`) ab. Job-Arten:

| Job | Aufgabe |
|---|---|
| `notify.submission` | E-Mail-Benachrichtigung über eine neue Antwort |
| `workflow.run` | Automation ausführen: E-Mail, Bestätigung an Absender, Webhook, Status setzen, Freigabe, PDF |
| `retention.sweep` | tägliche Bereinigung, einmal pro Tag ab 01:30 UTC (03:30 Uhr Sommerzeit, 02:30 Uhr Winterzeit): Antworten mit abgelaufener Aufbewahrungsfrist, Formulare nach 30 Tagen im Papierkorb, abgelaufene Zwischenstände, verwaiste Uploads und Objekte nach 24 Stunden, abgelaufene Sitzungen, erledigte Jobs nach 30 Tagen |
| `file.rescan` | stündlich: ungeprüfte Uploads nachprüfen, sobald ein Virenscanner erreichbar ist |

Verhalten im Einzelnen:

- **Abholen:** Neue Jobs wecken den Worker über `LISTEN/NOTIFY` (Kanal `plica_jobs`); zusätzlich fragt er alle 2 s ab. Er nimmt Jobs mit `FOR UPDATE SKIP LOCKED`, mehrere Worker blockieren sich also nicht. Parallelität: `WORKER_CONCURRENCY` (Standard 4).
- **Schritte nur einmal:** Jeder abgeschlossene Schritt einer Automation wird sofort im Job festgeschrieben. Nach Absturz oder Wiederholung führt der Worker erledigte Schritte nicht erneut aus.
- **Wiederholung:** Scheitert ein Job, plant der Worker ihn neu: nach etwa 30 s, 1, 2, 4 … Minuten bis höchstens 6 Stunden, jeweils mit ±20 % Streuung. Standard sind 12 Versuche, zusammen rund 16 Stunden (etwa für einen SMTP-Ausfall). Danach ist der Job `dead`.
- **Endgültige Fehler** (etwa eine Antwort HTTP 400 eines Webhook-Ziels) setzen den Job ohne weitere Versuche auf `failed`.
- **Absturz:** Laufende Jobs melden sich alle 30 s. Bleibt die Meldung 2 Minuten aus, reiht ein Worker den Job wieder ein (oder setzt ihn auf `dead`, wenn die Versuche erschöpft sind). Die Prüfung läuft einmal pro Minute.
- **Herunterfahren:** Auf `SIGTERM` lässt der Worker laufende Jobs bis zu 25 s zu Ende laufen und gibt den Rest ohne Zählung des Versuchs frei. `compose.yml` gewährt dafür 30 s (`stop_grace_period`).

Gescheiterte Zustellungen der letzten 30 Tage zeigt PLICA Personen mit dem Recht, Automationen zu bearbeiten, auf der Startseite („… Zustellungen oder Automationen sind fehlgeschlagen“) und im Reiter **Automationen** des Formulars, jeweils mit **Erneut versuchen**.

## Monitoring-Empfehlungen

PLICA bringt kein eigenes Monitoring mit. Überwachen Sie mindestens:

1. **Erreichbarkeit:** `https://<ihre-domain>/healthz` von außen, Alarm bei Status ungleich 200.
2. **Container:** `docker compose ps` – `app` muss `healthy` sein, `worker`, `db` und `storage` müssen laufen. Weil der Worker keinen Healthcheck hat, prüfen Sie ihn über Prozessstatus und Logs.
3. **Gescheiterte Zustellungen:** Jobs mit Status `dead` oder `failed`. Sie bleiben in der Tabelle `jobs` stehen (die Bereinigung entfernt nur erledigte Jobs).

   ```bash
   docker compose exec -T db psql -U plica -d plica -c \
     "select type, status, count(*), max(finished_at) from jobs where status in ('dead','failed') and finished_at > now() - interval '1 day' group by 1, 2"
   ```

4. **Stau in der Queue:** wartende Jobs, die schon lange fällig sind, deuten auf einen stehenden Worker hin.

   ```bash
   docker compose exec -T db psql -U plica -d plica -tAc \
     "select count(*) from jobs where status = 'queued' and run_at < now() - interval '15 minutes'"
   ```

5. **Plattenplatz:** Volumes `db`, `files` und `backups` sowie das Docker-Verzeichnis des Hosts. Eine volle Platte lässt Uploads, Sicherungen und Datenbank scheitern.

   ```bash
   docker system df -v
   df -h /var/lib/docker
   ```

6. **Sicherungen:** Ergebnis des cron-Laufs (Logdatei) und Alter der neuesten Datei in `plica backups`, dazu die externe Kopie (siehe [Sicherung](23-sicherung.md)).
7. **Virenscanner** (falls eingesetzt): `virusScanner` in `/healthz` muss `ok` sein.

Passen Sie Benutzer und Datenbankname an, falls Sie `POSTGRES_USER` oder `POSTGRES_DB` geändert haben.

## Härtung der Container

`migrate`, `app` und `worker` laufen als unprivilegierter Nutzer `node`, mit schreibgeschütztem Dateisystem (beschreibbar sind nur tmpfs-Bereiche wie `/tmp` und bei `app` und `worker` das Volume `/backups`), ohne Linux-Capabilities, mit `no-new-privileges`, Speicher- und Prozessgrenzen und Log-Rotation. `npm`, `npx` und `corepack` sind im Laufzeit-Image entfernt. `db`, `storage` und `clamav` hängen nur im internen Netz und sind von außen nicht erreichbar.

← [Updates](24-updates.md) · weiter: [Architektur](26-architektur.md) →
