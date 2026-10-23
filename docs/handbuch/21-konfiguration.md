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
| `TRUST_PROXY` | nein | `true` hinter einem Reverse Proxy. PLICA nimmt als Client-IP den letzten Eintrag in `X-Forwarded-For` – den hängt Ihr Proxy an; vom Client gefälschte Einträge davor zählen nicht. Ohne Proxy ist ein Fälschen möglich, daher Produktion immer hinter einem Proxy betreiben. |
| `WEBHOOK_ALLOW_PRIVATE` | nein | Webhooks an private Netze erlauben (z. B. j-lawyer im LAN). Standard: gesperrt (SSRF-Schutz). |
| `SETUP_CODE` | nein | Fester Einrichtungscode für automatisierte Installationen. |
| `BACKUP_KEEP` | nein | Anzahl aufbewahrter automatischer Sicherungen (Standard 14). |
| `WORKER_CONCURRENCY` | nein | Gleichzeitig verarbeitete Jobs je Worker. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | nein | Optionale OpenAI-kompatible KI für „Formular aus Beschreibung“. Ohne KI arbeitet PLICA mit einem eingebauten, regelbasierten Generator. |
| `OIDC_ISSUER` | nein | Anmeldung über einen OIDC-Anbieter (z. B. authentik), z. B. `https://login.kanzlei.de/application/o/plica/`. Aktiv, sobald gesetzt; in Produktion nur `https://`. Siehe [Anmeldung über authentik](#anmeldung-über-authentik-oidc). |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | ja (mit OIDC) | Zugangsdaten des vertraulichen Clients beim Anbieter. |
| `OIDC_NAME` | nein | Beschriftung des Knopfs „Mit … anmelden“ (Standard „Kanzlei-Login“). |
| `OIDC_SCOPES` | nein | Standard `openid profile email`. authentik liefert `groups` im Scope `profile` – `groups` nicht zusätzlich anfragen. |
| `OIDC_ALLOWED_GROUPS` | nein | Kommagetrennt; nur Mitglieder dieser Gruppen (oder der Admin-Gruppen) dürfen sich anmelden. Leer = alle. |
| `OIDC_ADMIN_GROUPS` | nein | Kommagetrennt; Mitglieder werden im Standard-Workspace Administrator. |
| `OIDC_AUTO_CREATE_USERS` | nein | `true`: Unbekannte Personen mit bestätigter E-Mail werden beim ersten Anmelden angelegt. |
| `OIDC_DEFAULT_ROLE` | nein | `editor`, `reviewer`, `viewer` oder `admin`: Rolle im Standard-Workspace für alle, die keiner Admin-Gruppe angehören. Leer = Rolle nur über Einladung bzw. Admin-Gruppe. |
| `OIDC_LOGOUT` | nein | `true`: Abmelden beendet auch die Sitzung beim Anbieter (`end_session_endpoint`). |
| `LOCAL_LOGIN` | nein | `visible` (Standard) oder `hidden`: Mit SSO die Passwort-Anmeldung ausblenden. Sie bleibt als Notzugang unter `/login?lokal=1` erreichbar. |
| `PLICA_BIND`, `PLICA_PORT` | nein | Bindung des App-Ports (Standard `127.0.0.1:3000`). |
| `PLICA_IMAGE`, `STORAGE_IMAGE` | nein | Abweichende Images. |

## Anmeldung über authentik (OIDC)

PLICA meldet über **Authorization Code mit PKCE** an (vertraulicher Client, Discovery über `/.well-known/openid-configuration`). state, nonce und die Signatur des ID-Tokens (JWKS) werden geprüft.

**Redirect-URI:** `${APP_URL}/api/auth/oidc/callback`, z. B. `https://forms.kanzlei.de/api/auth/oidc/callback`.
**Abmelde-Rücksprung** (bei `OIDC_LOGOUT=true`): `${APP_URL}/login`.

Einrichtung in authentik (getestet mit 2026.8.5):

1. **Scope-Mapping für E-Mail anlegen.** Das mitgelieferte Mapping `email` meldet `email_verified` immer `false`. PLICA verknüpft und legt Konten aber nur mit bestätigter Adresse an. Eigenes Mapping mit Scope `email`, z. B.:
   ```python
   return {"email": request.user.email, "email_verified": True}
   ```
   (oder bedingt über ein Benutzerattribut wie `request.user.attributes.get("email_verified", False)`).
2. **OAuth2/OpenID-Provider** anlegen: Client-Typ *Confidential*, Grant-Type **authorization_code** ausdrücklich auswählen (ohne ihn antwortet authentik mit `invalid_request`), Signaturschlüssel setzen, Scope-Mappings `openid`, `profile` und das eigene `email`-Mapping. Redirect-URIs: die Callback-Adresse (*strict*, Typ Autorisierung) und – für das Abmelden – `${APP_URL}/login` (*strict*, Typ Logout).
3. **Application** mit dem Slug `plica` anlegen; der Issuer lautet dann `https://<authentik>/application/o/plica/`.
4. Gruppen anlegen, z. B. `plica` (Zugang) und `admin` (Administratoren).

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

**Kontozuordnung.** Konten werden dauerhaft über Issuer und `sub` zugeordnet. Ein bestehendes lokales Konto wird beim ersten SSO-Anmelden per E-Mail-Adresse verknüpft – nur bei `email_verified=true`, sonst ließe sich ein Konto über eine fremde, unbestätigte Adresse übernehmen. Über SSO angelegte Konten haben kein Passwort.

**Rollen.** Bei jeder Anmeldung gleicht PLICA die Rolle im **Standard-Workspace** (dem ältesten) an die Gruppen an: Admin-Gruppe → Administrator, sonst `OIDC_DEFAULT_ROLE`. Ohne Standardrolle bleibt die Rolle von Nicht-Admins unverändert. Inhaber bleiben Inhaber, solange sie in einer Admin-Gruppe sind; der letzte Inhaber eines Workspace wird nie herabgestuft. Weitere Workspaces vergeben Rollen weiter über Einladungen.

**Zwei-Faktor.** Bei der SSO-Anmeldung fragt PLICA keinen eigenen TOTP-Code ab – den zweiten Faktor erzwingt der Anbieter (in authentik im Authentifizierungs-Flow einrichten). Lokale Konten behalten ihre Zwei-Faktor-Anmeldung.

**Notzugang.** Die Passwort-Anmeldung bleibt immer möglich (`/login?lokal=1`), damit der Inhaber bei einem Ausfall des Anbieters nicht ausgesperrt ist. Das Inhaberkonto sollte deshalb ein starkes Passwort und TOTP haben.

**Proxy.** Hinter Caddy im selben Docker-Netz `TRUST_PROXY=true` setzen (ein Hop). PLICA baut die Redirect-URI immer aus `APP_URL`, nicht aus Proxy-Headern.

## Entwicklung und Produktion bleiben getrennt

- Entwicklung: `docker/compose.dev.yml` (Postgres, Speicher, **Mailpit**), Ports 47xx auf 127.0.0.1, Zugangsdaten mit dem Kennzeichen `dev-only`.
- Produktion: `compose.yml`, kein Mailpit, keine Testdaten, Werte nur aus `.env`. `PLICA_ENV=production` lehnt Entwicklungsschlüssel ab.

← [Installation](20-installation.md) · weiter: [Reverse Proxy](22-reverse-proxy.md) →
