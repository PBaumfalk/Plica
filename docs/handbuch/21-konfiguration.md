# 21 · Konfiguration

PLICA liest alle Einstellungen aus Umgebungsvariablen. In Produktion stehen sie in der Datei `.env` neben `compose.yml` (Vorlage: [`.env.example`](../../.env.example)). Die Variablen der Anwendung prüft PLICA beim Start (`src/server/config.ts`). Fehlt etwas oder ist ein Wert ungültig, steht im Log eine Meldung wie:

```
PLICA: Konfiguration ungültig:
  SECRET_KEY: SECRET_KEY muss mindestens 32 Zeichen lang sein (openssl rand -hex 32).
```

Der Worker beendet sich dann und wird von Docker immer wieder neu gestartet. Die App läuft weiter, beantwortet aber keine Anfragen sinnvoll und wird als `unhealthy` gemeldet. Prüfen Sie deshalb nach jeder Änderung:

```bash
docker compose ps
docker compose logs --tail 50 app worker
```

Nach einer Änderung an `.env` übernehmen Sie die Werte mit:

```bash
docker compose up -d
```

Compose erstellt dann die betroffenen Container neu. Ein bloßes `docker compose restart` liest `.env` nicht neu ein.

## Grundeinstellungen

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `APP_URL` | ja | – | Adresse der Verwaltung ohne abschließenden Schrägstrich, z. B. `https://plica.example.de`. Daraus baut PLICA Einladungs- und Freigabelinks, die SSO-Rücksprungadresse und den API-Pfad. Beginnt sie mit `https://`, setzt PLICA Cookies als `Secure` mit `__Host-`-Präfix und sendet HSTS. |
| `PUBLIC_URL` | nein | = `APP_URL` | Eigene Adresse nur für öffentliche Formulare, z. B. `https://formulare.kanzlei.de`. Formularlinks, QR-Codes, Fortsetzungslinks und der Einbettungscode verwenden dann diese Adresse; dort antwortet die Verwaltung mit 404. Siehe [Reverse Proxy](22-reverse-proxy.md#eigene-domain-für-öffentliche-formulare). |
| `SECRET_KEY` | ja | – | Mindestens 32 Zeichen, erzeugt mit `openssl rand -hex 32`. PLICA leitet daraus per HKDF getrennte Schlüssel ab, u. a. für Zwei-Faktor-Geheimnisse, Zwischenstände, Webhook-Geheimnisse, den SSO-Anmeldezustand und signierte Links. **Nach Inbetriebnahme nicht ändern**, sonst sind verschlüsselte Werte unlesbar. Getrennt vom Server sichern. |
| `PLICA_ENV` | nein | `production` | `production`, `development` oder `test`. In Produktion lehnt PLICA Entwicklungsschlüssel (Kennzeichen `dev-only`) und einen `OIDC_ISSUER` ohne `https://` ab. |
| `TRUST_PROXY` | nein | `false` | `true` hinter einem Reverse Proxy. Siehe [Reverse Proxy](22-reverse-proxy.md#client-ip-hinter-dem-proxy). |
| `SETUP_CODE` | nein | zufällig | Fester Einrichtungscode für automatisierte Installationen. Ohne Angabe erzeugt PLICA einen Code und schreibt ihn ins Log (siehe [Installation](20-installation.md#ersteinrichtung)). |

## Datenbank und Objektspeicher

Mit der mitgelieferten `compose.yml` setzen Sie nur die `POSTGRES_*`- und `S3_ROOT_*`-Werte. `DATABASE_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` und `S3_FORCE_PATH_STYLE` bildet Compose daraus selbst; eigene Werte in `.env` werden für diese fünf Variablen überschrieben.

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `POSTGRES_PASSWORD` | ja (Compose) | – | Passwort der mitgelieferten Datenbank. |
| `POSTGRES_USER`, `POSTGRES_DB` | nein | `plica`, `plica` | Benutzer und Datenbankname. |
| `S3_ROOT_USER`, `S3_ROOT_PASSWORD` | ja (Compose) | – | Zugangsdaten des mitgelieferten Objektspeichers (RustFS); PLICA nutzt sie auch als S3-Zugang. |
| `DATABASE_URL` | ja (ohne Compose) | – | PostgreSQL-Verbindung, z. B. `postgres://user:pass@host:5432/plica`. |
| `S3_ENDPOINT` | ohne Compose | – | Adresse eines beliebigen S3-kompatiblen Speichers. Ohne Angabe nutzt das SDK AWS S3. |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | ja (ohne Compose) | – | Zugang zum Speicher. |
| `S3_BUCKET` | nein | `plica` | Bucket; PLICA legt ihn bei Bedarf an. |
| `S3_REGION` | nein | `us-east-1` | Region. |
| `S3_FORCE_PATH_STYLE` | nein | `true` | Pfad-Adressierung (`host/bucket`) statt Subdomain. Für RustFS und MinIO `true`. |

## E-Mail

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `SMTP_URL` | nein | – | SMTP-Zugang als URL: `smtps://benutzer:passwort@mail.example.de:465` (TLS) oder `smtp://benutzer:passwort@mail.example.de:587` (STARTTLS). Sonderzeichen in Benutzer oder Passwort URL-kodieren (z. B. `@` als `%40`). |
| `MAIL_FROM` | nein | `PLICA <plica@localhost>` | Absender, z. B. `"Kanzlei Musterstadt <formulare@example.de>"`. Der SMTP-Server muss diese Adresse erlauben. |

Ohne `SMTP_URL` versendet PLICA keine E-Mails. In der Oberfläche ist **Einladung per E-Mail senden** dann ausgegraut; Einladungslinks geben Sie direkt weiter. E-Mail-Schritte in Automationen schlagen mit „E-Mail-Versand ist nicht eingerichtet (SMTP_URL fehlt).“ fehl und erscheinen im Automationsprotokoll.

## Uploads und Virenprüfung

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `UPLOAD_MAX_MB` | nein | `25` | Obergrenze je Datei in MB (1 bis 500). Felder im Formular können niedriger begrenzen. Den Reverse Proxy etwas großzügiger einstellen. |
| `CLAMAV_HOST` | nein | – | Host des clamd-Dienstes, mit dem Compose-Profil `clamav`. Ohne Angabe bleiben Uploads ungeprüft in Quarantäne (siehe [Installation](20-installation.md#mit-virenscanner)). |
| `CLAMAV_PORT` | nein | `3310` | Port von clamd. |

## Einbettung und Webhooks

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `EMBED_ORIGINS` | nein | `*` | Websites, die Formulare per iframe einbetten dürfen (CSP `frame-ancestors`), z. B. `https://www.example.de`. Mehrere Origins durch Leerzeichen trennen und in Anführungszeichen setzen. Gilt nur für `/f/…` und `/r/…`; die Verwaltung ist nie einbettbar. |
| `WEBHOOK_ALLOW_PRIVATE` | nein | `false` | `true` erlaubt Webhooks an `localhost` und private Netze, etwa an j-lawyer im LAN. Standardmäßig gesperrt (Schutz vor SSRF). |

## KI-Unterstützung (optional)

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `AI_BASE_URL` | nein | – | Basisadresse einer OpenAI-kompatiblen API, z. B. eines lokalen Ollama. PLICA ruft `<AI_BASE_URL>/chat/completions` auf. |
| `AI_MODEL` | nein | – | Modellname. KI ist nur aktiv, wenn `AI_BASE_URL` und `AI_MODEL` gesetzt sind. |
| `AI_API_KEY` | nein | – | Wird als `Bearer`-Token mitgesendet, falls gesetzt. |

Die KI hilft nur bei „Formular aus Beschreibung“. Ohne KI oder bei einem Fehler nutzt PLICA seinen eingebauten, regelbasierten Generator. Beachten Sie: Die eingegebene Beschreibung geht an den konfigurierten Dienst.

## Anmeldung (SSO)

| Variable | Pflicht | Standard | Bedeutung |
|---|---|---|---|
| `OIDC_ISSUER` | nein | – | Issuer des OIDC-Anbieters, z. B. `https://login.kanzlei.de/application/o/plica/`. SSO ist aktiv, sobald gesetzt; in Produktion nur mit `https://`. |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | ja (mit OIDC) | – | Zugangsdaten des vertraulichen Clients. Fehlt einer der beiden, startet PLICA nicht. |
| `OIDC_NAME` | nein | `Kanzlei-Login` | Beschriftung des Knopfs „Mit … anmelden“ (höchstens 60 Zeichen). |
| `OIDC_SCOPES` | nein | `openid profile email` | Angefragte Scopes. authentik liefert `groups` im Scope `profile` – `groups` nicht zusätzlich anfragen. |
| `OIDC_ALLOWED_GROUPS` | nein | leer | Kommagetrennt. Nur Mitglieder dieser Gruppen oder der Admin-Gruppen dürfen sich über SSO anmelden. Leer = alle. |
| `OIDC_ADMIN_GROUPS` | nein | leer | Kommagetrennt. Mitglieder werden im Standard-Workspace Administrator. |
| `OIDC_AUTO_CREATE_USERS` | nein | `false` | `true`: Unbekannte Personen mit bestätigter E-Mail-Adresse werden beim ersten Anmelden angelegt. |
| `OIDC_DEFAULT_ROLE` | nein | leer | `editor`, `reviewer`, `viewer` oder `admin`: Rolle im Standard-Workspace für alle, die keiner Admin-Gruppe angehören. Leer = Rolle nur über Einladung bzw. Admin-Gruppe. |
| `OIDC_LOGOUT` | nein | `false` | `true`: Abmelden beendet auch die Sitzung beim Anbieter (`end_session_endpoint`). |
| `LOCAL_LOGIN` | nein | `visible` | `hidden` blendet bei aktivem SSO die Passwort-Anmeldung aus. Sie bleibt als Notzugang unter `/login?lokal=1` erreichbar. |

Für boolesche Variablen gelten `true`, `false`, `1` und `0`.

## Nur für Compose und Betrieb

Diese Variablen liest nicht die Anwendungsprüfung, sondern `compose.yml`, der Worker oder die Kommandozeile.

| Variable | Standard | Bedeutung |
|---|---|---|
| `PLICA_BIND` | `127.0.0.1` | Adresse, an die der App-Port auf dem Host gebunden wird. Nur ändern, wenn der Proxy auf einem anderen Rechner läuft. |
| `PLICA_PORT` | `3000` | Host-Port der App. |
| `PLICA_IMAGE` | `plica:local` | Image für `migrate`, `app` und `worker`, z. B. aus einer Registry. |
| `STORAGE_IMAGE` | `rustfs/rustfs:1.0.3` | Image des Objektspeichers. |
| `CLAMAV_IMAGE` | `clamav/clamav-debian:stable` | Image des Virenscanners. |
| `PLICA_ENV_FILE` | `.env` | Datei, aus der die Container ihre Variablen lesen. Werte für `${…}` in `compose.yml` liest Compose weiterhin aus `.env` im Projektordner bzw. `--env-file`. |
| `WORKER_CONCURRENCY` | `4` | Gleichzeitig verarbeitete Jobs je Worker. |
| `BACKUP_KEEP` | `14` | Anzahl aufbewahrter automatischer Sicherungen (siehe [Sicherung und Wiederherstellung](23-sicherung.md)). |

Fest im Image gesetzt und nicht zu ändern sind `PORT=3000`, `HOSTNAME=0.0.0.0`, `NODE_ENV=production` und `BACKUP_DIR=/backups`.

## Anmeldung über authentik (OIDC)

PLICA meldet über **Authorization Code mit PKCE** an (vertraulicher Client, Discovery über `/.well-known/openid-configuration`). state, nonce und die Signatur des ID-Tokens (JWKS) werden geprüft. Die Einrichtung ist mit authentik 2026.8.5 getestet.

### Adressen für den Anbieter

| Zweck | Adresse |
|---|---|
| Redirect-URI | `${APP_URL}/api/auth/oidc/callback`, z. B. `https://plica.example.de/api/auth/oidc/callback` |
| Abmelde-Rücksprung (nur bei `OIDC_LOGOUT=true`) | `${APP_URL}/login` |

PLICA baut die Redirect-URI immer aus `APP_URL`, nie aus Proxy-Headern.

### Einrichtung in authentik

1. **Scope-Mapping für E-Mail anlegen.** Das mitgelieferte Mapping `email` meldet `email_verified` immer `false`. PLICA verknüpft und legt Konten aber nur mit bestätigter Adresse an. Legen Sie ein eigenes Mapping mit Scope `email` an, z. B.:
   ```python
   return {"email": request.user.email, "email_verified": True}
   ```
   Oder bedingt über ein Benutzerattribut wie `request.user.attributes.get("email_verified", False)`.
2. **OAuth2/OpenID-Provider** anlegen:
   - Client-Typ *Confidential*.
   - Grant-Type **authorization_code** ausdrücklich auswählen. Ohne ihn antwortet authentik mit `invalid_request`.
   - Signaturschlüssel setzen.
   - Scope-Mappings `openid`, `profile` und das eigene `email`-Mapping.
   - Redirect-URIs: die Callback-Adresse (*strict*, Typ Autorisierung) und – für das Abmelden – `${APP_URL}/login` (*strict*, Typ Logout).
3. **Application** mit dem Slug `plica` anlegen. Der Issuer lautet dann `https://<authentik>/application/o/plica/`.
4. **Gruppen** anlegen, z. B. `plica` (Zugang) und `admin` (Administratoren).

### Variablen in PLICA

Beispiel für `.env`:

```
OIDC_ISSUER=https://login.kanzlei.de/application/o/plica/
OIDC_CLIENT_ID=…
OIDC_CLIENT_SECRET=…
OIDC_ALLOWED_GROUPS=plica
OIDC_ADMIN_GROUPS=admin
OIDC_AUTO_CREATE_USERS=true
OIDC_DEFAULT_ROLE=editor
OIDC_LOGOUT=true
LOCAL_LOGIN=hidden
```

Danach `docker compose up -d`. Auf der Anmeldeseite erscheint der Knopf „Mit Kanzlei-Login anmelden“ (Text aus `OIDC_NAME`).

### Kontozuordnung

Konten werden dauerhaft über Issuer und `sub` zugeordnet. Ein bestehendes lokales Konto wird beim ersten SSO-Anmelden per E-Mail-Adresse verknüpft – nur bei `email_verified=true`, sonst ließe sich ein Konto über eine fremde, unbestätigte Adresse übernehmen. Über SSO angelegte Konten haben kein Passwort.

Ohne `OIDC_AUTO_CREATE_USERS=true` kann sich über SSO nur anmelden, wer bereits ein PLICA-Konto mit derselben bestätigten Adresse hat, etwa nach einer Einladung.

### Rollen

Bei jeder Anmeldung gleicht PLICA die Rolle im **Standard-Workspace** (dem ältesten) an die Gruppen an: Admin-Gruppe → Administrator, sonst `OIDC_DEFAULT_ROLE`. Ohne Standardrolle bleibt die Rolle von Nicht-Admins unverändert. Inhaber bleiben Inhaber, solange sie in einer Admin-Gruppe sind; der letzte Inhaber eines Workspace wird nie herabgestuft. Weitere Workspaces vergeben Rollen weiter über Einladungen.

Was das für die Rollenverwaltung im Team bedeutet, steht in [Team und Rollen](10-team-rollen.md#rollen-bei-anmeldung-über-sso).

### Zwei-Faktor

Bei der SSO-Anmeldung fragt PLICA keinen eigenen TOTP-Code ab – den zweiten Faktor erzwingt der Anbieter (in authentik im Authentifizierungs-Flow einrichten). Lokale Konten behalten ihre Zwei-Faktor-Anmeldung.

### Notzugang

Die Passwort-Anmeldung bleibt immer möglich (`/login?lokal=1`), damit der Inhaber bei einem Ausfall des Anbieters nicht ausgesperrt ist. Das Inhaberkonto sollte deshalb ein starkes Passwort und TOTP haben.

### Proxy

Hinter Caddy im selben Docker-Netz `TRUST_PROXY=true` setzen (ein Hop). PLICA baut die Redirect-URI immer aus `APP_URL`, nicht aus Proxy-Headern.

### Fehlermeldungen

Scheitert die Anmeldung, landet die Person auf `/login` mit einer Meldung. Einzelheiten stehen im Log der App.

| Meldung (gekürzt) | Ursache |
|---|---|
| „… ist für PLICA nicht freigeschaltet“ | Person in keiner Gruppe aus `OIDC_ALLOWED_GROUPS` oder `OIDC_ADMIN_GROUPS`. |
| „… beim Anmeldedienst nicht bestätigt“ | `email_verified` fehlt oder ist `false` – Scope-Mapping aus Schritt 1 prüfen. |
| „Für dieses Konto gibt es keinen Zugang zu PLICA“ | Kein passendes Konto und `OIDC_AUTO_CREATE_USERS` nicht aktiv. |
| „… bereits eine andere SSO-Verknüpfung“ | Das PLICA-Konto mit dieser Adresse ist schon mit einem anderen SSO-Konto verknüpft. |
| „Der Anmeldedienst ist gerade nicht erreichbar“ | Discovery beim Issuer fehlgeschlagen (Adresse, TLS, Netz) oder zu viele Versuche. |
| „PLICA ist noch nicht eingerichtet“ | Die Ersteinrichtung mit dem Einrichtungscode fehlt noch; vorher ist keine SSO-Anmeldung möglich. |
| „Die Anmeldung hat zu lange gedauert“ | Anmeldung nicht binnen 10 Minuten abgeschlossen oder in einem anderen Tab gestartet. |

## Entwicklung und Produktion bleiben getrennt

- **Entwicklung:** `docker/compose.dev.yml` (Postgres, Speicher, **Mailpit**), Ports 47xx auf 127.0.0.1, Zugangsdaten mit dem Kennzeichen `dev-only`, Werte in `.env.local`.
- **Produktion:** `compose.yml`, kein Mailpit, keine Testdaten, Werte nur aus `.env`. `PLICA_ENV=production` (Standard) lehnt Entwicklungsschlüssel ab.

← [Installation](20-installation.md) · weiter: [Reverse Proxy](22-reverse-proxy.md) →
