# 25 · Betrieb und Kommandozeile

## Kommandozeile

Im Container steht `plica` zur Verfügung:

| Befehl | Wirkung |
|---|---|
| `plica backup [--auto]` | Sicherung anlegen (siehe [Sicherung](23-sicherung.md)) |
| `plica backups` | Sicherungen auflisten |
| `plica verify <datei>` | Sicherung prüfen |
| `plica restore <datei> --yes` | Sicherung wiederherstellen |
| `plica setup-code` | Einrichtungscode anzeigen (nur vor der Ersteinrichtung) |
| `plica reset-password <email>` | Zufälliges neues Passwort setzen, alle Sitzungen beenden |
| `plica health` | Gesundheitsprüfung (Datenbank und Speicher) |

Aufruf: `docker compose exec app plica <befehl>`.

## Gesundheit

`GET /healthz` antwortet mit `200 {"status":"ok","database":"ok","storage":"ok"}` oder `503`. Der Docker-Healthcheck nutzt `plica health`. Die Antwort enthält keine Versions- oder Konfigurationsdetails.

## Logs

```bash
docker compose logs -f app worker
```

Logs gehen als JSON-Datei-Logs mit Rotation (10 MB × 5) an Docker. PLICA schreibt keine Passwörter, Tokens oder Antwortinhalte ins Log. IP-Adressen werden für Ratenbegrenzung und Spam-Schutz nur als tagesgebundener Hash verwendet.

## Worker

Der Worker verarbeitet die dauerhafte Job-Queue in PostgreSQL (E-Mails, Webhooks, Workflows, PDF-Erzeugung, Aufbewahrungsfristen). Jobs überleben Neustarts; ein abgebrochener Job wird nach Ablauf seiner Sperre erneut aufgenommen. Bereits erledigte Schritte eines Workflows werden dabei nicht wiederholt. Fehlgeschlagene Jobs werden mit wachsendem Abstand wiederholt und nach der Höchstzahl an Versuchen als „dead“ markiert; das Protokoll steht in der Oberfläche unter **Automationen**.

## Härtung der Container

`app`, `worker` und `migrate` laufen als unprivilegierter Nutzer, mit schreibgeschütztem Dateisystem, ohne Linux-Capabilities, mit `no-new-privileges`, Speicher- und Prozessgrenzen und Log-Rotation. npm, npx und corepack sind im Laufzeit-Image entfernt.

← [Updates](24-updates.md) · weiter: [Architektur](26-architektur.md) →
