# 24 · Updates und Rollback

## Update

```bash
cd /opt/plica
docker compose exec app plica backup      # 1. sichern
git pull                                  # 2. neue Version holen (oder PLICA_IMAGE-Tag erhöhen)
docker compose up -d --build              # 3. bauen und starten – Migrationen laufen automatisch
docker compose ps                         # app: healthy
```

Der Dienst `migrate` führt ausstehende Datenbankmigrationen aus, bevor `app` und `worker` starten. Schlägt eine Migration fehl, starten App und Worker nicht; die alte Datenbank bleibt unverändert, soweit die Migration transaktional war.

## Rollback

Migrationen sind nur vorwärts gerichtet. Für ein Rollback:

```bash
git checkout <vorherige-version>
docker compose up -d --build
docker compose exec app plica restore /backups/<sicherung-vor-dem-update>.tar.gz --yes
docker compose restart app worker
```

Antworten, die zwischen Update und Rollback eingegangen sind, gehen dabei verloren. Exportieren Sie sie vorher (CSV/XLSX).

## Hinweise

- Lesen Sie vor dem Update die Änderungsnotizen.
- Ändern Sie `SECRET_KEY` nie im Zuge eines Updates.
- Image-Tags fest pinnen (`PLICA_IMAGE=…:0.1.0`), nicht `latest`.

← [Sicherung](23-sicherung.md) · weiter: [Betrieb und CLI](25-betrieb-cli.md) →
