# 21 · Konfiguration

Alle Einstellungen kommen aus Umgebungsvariablen. Produktion: Datei `.env` neben `compose.yml` (Vorlage: [`.env.example`](../../.env.example)). Entwicklung: `.env.local`. PLICA prüft die Werte beim Start und beendet sich mit einer verständlichen Meldung, wenn etwas fehlt oder ungültig ist.

| Variable | Pflicht | Bedeutung |
|---|---|---|
| `APP_URL` | ja | Adresse der Verwaltung, z. B. `https://plica.kanzlei.de`. Mit `https://` werden Cookies als `Secure` gesetzt (`__Host-`-Präfix) und HSTS gesendet. |
| `PUBLIC_URL` | nein | Eigene Domain nur für öffentliche Formulare. Dort antwortet die Verwaltung mit 404. |
| `SECRET_KEY` | ja | Mindestens 32 Zeichen. Daraus leitet PLICA per HKDF getrennte Schlüssel ab (TOTP, Zwischenstände, Webhook-Geheimnisse, Signaturen). **Nach Inbetriebnahme nicht ändern**, sonst sind verschlüsselte Werte unlesbar. |
| `PLICA_ENV` | nein | `production` (Standard), `development`, `test`. In Produktion wird ein Entwicklungsschlüssel abgelehnt. |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | ja (Compose) | Zugang zur mitgelieferten Datenbank; `DATABASE_URL` wird daraus gebildet. |
| `DATABASE_URL` | ja (ohne Compose) | PostgreSQL-Verbindung, z. B. `postgres://user:pass@host:5432/plica`. |
| `S3_ROOT_USER`, `S3_ROOT_PASSWORD` | ja (Compose) | Zugang zum mitgelieferten Objektspeicher. |
| `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE` | ja (ohne Compose) | Beliebiger S3-kompatibler Speicher. Der Bucket wird bei Bedarf angelegt. |
| `SMTP_URL` | nein | `smtps://user:pass@host:465` oder `smtp://…:587`. Ohne SMTP schlagen E-Mail-Schritte protokolliert fehl. |
| `MAIL_FROM` | nein | Absender, z. B. `"Kanzlei <formulare@kanzlei.de>"`. |
| `UPLOAD_MAX_MB` | nein | Obergrenze je Datei (Standard 25). Formulare können niedriger begrenzen. |
| `CLAMAV_HOST`, `CLAMAV_PORT` | nein | clamd für Virenprüfung (siehe [Installation](20-installation.md#mit-virenscanner)). |
| `EMBED_ORIGINS` | nein | Wo Formulare per iframe eingebettet werden dürfen (`*` oder Liste von Origins). Die Verwaltung ist nie einbettbar. |
| `TRUST_PROXY` | nein | `true` hinter einem Reverse Proxy, damit die Ratenbegrenzung die echte Client-IP nutzt. Nur setzen, wenn ein Proxy davor steht. |
| `WEBHOOK_ALLOW_PRIVATE` | nein | Webhooks an private Netze erlauben (z. B. j-lawyer im LAN). Standard: gesperrt (SSRF-Schutz). |
| `SETUP_CODE` | nein | Fester Einrichtungscode für automatisierte Installationen. |
| `BACKUP_KEEP` | nein | Anzahl aufbewahrter automatischer Sicherungen (Standard 14). |
| `WORKER_CONCURRENCY` | nein | Gleichzeitig verarbeitete Jobs je Worker. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | nein | Optionale OpenAI-kompatible KI für „Formular aus Beschreibung“. Ohne KI arbeitet PLICA mit einem eingebauten, regelbasierten Generator. |
| `PLICA_BIND`, `PLICA_PORT` | nein | Bindung des App-Ports (Standard `127.0.0.1:3000`). |
| `PLICA_IMAGE`, `STORAGE_IMAGE` | nein | Abweichende Images. |

## Entwicklung und Produktion bleiben getrennt

- Entwicklung: `docker/compose.dev.yml` (Postgres, Speicher, **Mailpit**), Ports 47xx auf 127.0.0.1, Zugangsdaten mit dem Kennzeichen `dev-only`.
- Produktion: `compose.yml`, kein Mailpit, keine Testdaten, Werte nur aus `.env`. `PLICA_ENV=production` lehnt Entwicklungsschlüssel ab.

← [Installation](20-installation.md) · weiter: [Reverse Proxy](22-reverse-proxy.md) →
