# 24 · Updates und Rollback

App, Worker, Migration und Kommandozeile kommen aus **einem** Image (`Dockerfile`, Node 24). In `compose.yml` verwenden die Dienste `migrate`, `app` und `worker` dasselbe Image `${PLICA_IMAGE:-plica:local}`.

## Vor jedem Update

- Änderungsnotizen der neuen Version lesen, insbesondere neue Migrationen und neue Konfigurationswerte.
- Eine manuelle Sicherung anlegen und deren Dateinamen notieren. Sie ist Ihr Rückweg (siehe [Sicherung](23-sicherung.md)).
- `SECRET_KEY` nie im Zuge eines Updates ändern.

```bash
cd /opt/plica
docker compose exec app plica backup
```

## Update mit selbst gebautem Image

```bash
git pull                              # neue Version holen
docker compose up -d --build          # Image bauen, migrieren, App und Worker neu starten
docker compose ps -a                  # app: healthy, migrate: Exited (0)
```

## Update mit Image aus einer Registry

Tragen Sie die neue Version fest als `PLICA_IMAGE=<registry>/plica:<version>` in die Konfigurationsdatei ein, nicht `latest`. Dann:

```bash
docker compose pull
docker compose up -d
docker compose ps
```

## Migrationen

Der Dienst `migrate` startet vor `app` und `worker` und führt `node dist/migrate.mjs` aus. Das Skript (`scripts/migrate.mjs`) wendet die SQL-Dateien aus `drizzle/` an, die in der Tabelle `drizzle.__drizzle_migrations` noch fehlen. Alle ausstehenden Migrationen laufen gemeinsam in **einer** Transaktion.

- **Erfolg:** `migrate` endet mit Code 0 und der Meldung „Migrationen ausgeführt.“. Erst dann starten `app` und `worker` (`depends_on: service_completed_successfully`).
- **Fehler:** `migrate` endet mit „Migration fehlgeschlagen: …“ und Code 1. PostgreSQL rollt die Transaktion zurück, die Datenbank bleibt auf dem alten Stand, App und Worker starten nicht.

```bash
docker compose logs migrate
```

Migrationen gehen nur vorwärts. Es gibt keine Abwärtsmigrationen; ein Rollback erfolgt über eine Sicherung.

### Aktueller Stand

| Migration | Inhalt |
|---|---|
| `0000_init` | Grundschema |
| `0001_oidc` | Anmeldung über OIDC: Spalten `sessions.via_oidc` (boolean, Standard `false`), `sessions.oidc_id_token` (text, verschlüsselt), `users.oidc_subject` (text) und eindeutiger Index `users_oidc_subject_idx` |

`0001_oidc` ergänzt nur Spalten und einen Index. Bestehende Konten und Sitzungen bleiben gültig. Die Migration läuft auch dann, wenn Sie OIDC nicht einschalten.

## Rollback

Ein Rollback bedeutet: alte Version **und** Datenstand aus der Sicherung vor dem Update. Alles, was nach dieser Sicherung entstanden ist (Antworten, Uploads, Änderungen an Formularen), geht verloren. Exportieren Sie neue Antworten vorher als CSV oder XLSX (siehe [Export und PDF](07-export-pdf.md)).

Reihenfolge, damit die alte Version nie auf das neue Schema trifft:

```bash
cd /opt/plica
docker compose stop worker
# 1. Mit der laufenden (neuen) Version die Sicherung vor dem Update einspielen
docker compose exec app plica restore /backups/<sicherung-vor-dem-update>.tar.gz --yes
docker compose stop app
# 2. Alte Version wählen
git checkout <vorherige-version>      # oder PLICA_IMAGE auf das alte Tag zurücksetzen
# 3. Alte Version starten (migrate findet nichts Ausstehendes)
docker compose up -d --build          # bei Registry-Images: docker compose pull && docker compose up -d
docker compose ps
```

Die Wiederherstellung bringt den Migrationsstand der Sicherung mit; deshalb hat `migrate` der alten Version danach nichts zu tun. Zwischen Schritt 1 und dem Anhalten von `app` läuft kurz die neue Version auf dem alten Schema. Rechnen Sie in diesen Sekunden mit Fehlermeldungen in der Oberfläche.

Die Wiederherstellung legt vorher automatisch eine Sicherung des Stands nach dem Update an (`plica-vor-wiederherstellung-…`). Damit können Sie das Update später erneut versuchen, ohne die zwischenzeitlichen Daten endgültig zu verlieren.

← [Sicherung](23-sicherung.md) · weiter: [Betrieb und CLI](25-betrieb-cli.md) →
