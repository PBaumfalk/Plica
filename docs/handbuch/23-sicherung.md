# 23 · Sicherung und Wiederherstellung

Eine PLICA-Sicherung ist **eine** Datei `plica-<art>-<zeitpunkt>.tar.gz` mit

- dem Datenbankabzug (`pg_dump`, Custom-Format),
- allen Dateien aus dem Objektspeicher (Uploads, Unterschriften, PDFs),
- einem Manifest mit SHA-256-Prüfsumme je Bestandteil.

Die Datei entsteht zunächst als `.tmp`, wird vollständig geprüft und erst dann umbenannt. Ein Abbruch hinterlässt nie eine scheinbar gültige Sicherung.

## Sichern

```bash
docker compose exec app plica backup          # manuell
docker compose exec app plica backups         # auflisten
docker compose exec app plica verify /backups/plica-manuell-2026-10-22_07-36-50.tar.gz
```

Sicherungen liegen im Volume `backups` (im Container `/backups`). Kopieren Sie sie regelmäßig auf ein anderes System:

```bash
docker compose cp app:/backups ./plica-backups
```

### Automatisch (cron auf dem Host)

```cron
30 2 * * * cd /opt/plica && docker compose exec -T app plica backup --auto >> /var/log/plica-backup.log 2>&1
```

`--auto` benennt die Datei `plica-auto-…` und behält die letzten `BACKUP_KEEP` (Standard 14) automatischen Sicherungen. Manuelle Sicherungen werden nie automatisch gelöscht.

## Wiederherstellen

> Die Wiederherstellung **ersetzt alle aktuellen Daten** (Datenbank und Dateien).

```bash
docker compose exec app plica backup                 # vorher den aktuellen Stand sichern
docker compose exec app plica restore /backups/<datei>.tar.gz --yes
docker compose restart app worker
```

Ohne `--yes` bricht der Befehl ab. Vor jeder Änderung prüft PLICA alle Prüfsummen; eine beschädigte Sicherung wird mit „Sicherung fehlerhaft“ abgelehnt, ohne dass Daten verändert werden.

## Nachweis

`scripts/docker-lifecycle-test.sh` führt den vollständigen Zyklus mit dem Produktions-Image aus: Einreichung mit Datei → Sicherung → Löschen von Datenbank und Dateien → Wiederherstellung → Prüfung, dass Antwort und Datei inhaltsgleich zurück sind.

## Was nicht in der Sicherung steckt

- die Datei `.env` (enthält `SECRET_KEY` – **getrennt und sicher aufbewahren**; ohne denselben Schlüssel sind TOTP-Geheimnisse, Zwischenstände und Webhook-Geheimnisse der Sicherung nicht lesbar),
- Container-Images (reproduzierbar über Git-Stand bzw. Image-Tag).

← [Reverse Proxy](22-reverse-proxy.md) · weiter: [Updates](24-updates.md) →
