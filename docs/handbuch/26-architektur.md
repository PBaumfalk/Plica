# 26 · Architektur

## Komponenten

```
                    Internet
                       │
             Reverse Proxy (TLS)            APP_URL     → Verwaltung + Formulare
                       │                    PUBLIC_URL  → nur Formulare (optional)
 ┌─────────────────────┼──────────────────────────── Netz „web“ ───────────┐
 │                     ▼                                                    │
 │  app  (Next.js 16, Node 24, Port 3000, Standard-Bindung 127.0.0.1)       │
 │    src/proxy.ts  CSP mit Nonce, Sicherheits-Header, Domain-Trennung      │
 │    Seiten + Server Actions   Verwaltung (Sitzung, Rollen)                │
 │    /f/*, /r/*, /api/public/* öffentliche Formulare, Uploads, Ereignisse  │
 │    /api/v1/*                 REST-API mit Bearer-Token                   │
 │    /api/auth/oidc/*          Anmeldung über OIDC                         │
 │    /healthz                  Gesundheitsprüfung                          │
 │                                                                          │
 │  worker (Node 24)  ── ausgehend: SMTP, Webhooks ──►                      │
 │  (app ausgehend: SMTP, OIDC-Anbieter, optional KI-Schnittstelle)         │
 └──────┬──────────────────────┬────────────────────────────────────────────┘
        │                      │
 ┌──────┼──────────────────────┼─────────────── Netz „internal“ (ohne Außenzugang)
 │      ▼                      ▼
 │  db       PostgreSQL 18     Daten + Job-Queue (Tabelle jobs)
 │  storage  RustFS (S3)       Uploads, Unterschriften, PDFs, Formularbilder
 │  clamav   optional          Virenprüfung über clamd (Profil „clamav“)
 │  migrate  einmalig          Migrationen vor dem Start von app und worker
 └──────────────────────────────────────────────────────────────────────────
```

| Dienst | Image | Aufgabe |
|---|---|---|
| `app` | PLICA-Image (`PLICA_IMAGE`, Standard `plica:local`) | Next.js-Server (`output: "standalone"`), Verwaltung, öffentliche Formulare, API |
| `worker` | dasselbe Image, `node dist/worker.mjs` | Job-Queue: E-Mails, Automationen, Webhooks, PDFs, Bereinigung, Nachprüfung von Uploads |
| `migrate` | dasselbe Image, `node dist/migrate.mjs` | Datenbankmigrationen aus `drizzle/`, endet danach |
| `db` | `postgres:18-alpine` | alle Daten und die Queue |
| `storage` | `rustfs/rustfs:1.0.3` (`STORAGE_IMAGE`) | S3-kompatibler Objektspeicher. MinIO verteilt seine Images nicht mehr öffentlich; jeder S3-Dienst funktioniert |
| `clamav` | `clamav/clamav-debian:stable`, nur mit `--profile clamav` | Virenprüfung; ohne Scanner landen Uploads in Quarantäne |

`db`, `storage` und `clamav` hängen nur im Netz `internal` (Docker-Option `internal: true`). `app` und `worker` hängen zusätzlich im Netz `web`, weil sie ausgehende Verbindungen brauchen (SMTP, Webhooks, OIDC-Anbieter, optional eine KI-Schnittstelle über `AI_BASE_URL`).

**Mailpit** gibt es nur in der Entwicklungsumgebung (`docker/compose.dev.yml`, SMTP auf `127.0.0.1:4725`, Oberfläche auf `127.0.0.1:4780`). In Produktion setzen Sie über `SMTP_URL` einen echten SMTP-Server.

## Module im Quelltext

| Ordner | Verantwortung |
|---|---|
| `src/lib/forms/` | **Formular-Engine**, isomorph (Browser und Server, ohne DOM und ohne Datenbank): Schema (Zod), Feldtypen, Ausdruckssprache für Berechnungen (eigener Parser, kein `eval`), Regel-Engine, Validierung (reguläre Ausdrücke mit RE2), statische Analyse (Zyklen, unmögliche Regeln, ungültige Verweise), Formatierung |
| `src/components/form/` | Renderer für Classic, Cards und Wizard; Eingabekomponenten aller Feldtypen |
| `src/components/builder/` | Visueller Editor mit automatischem Speichern |
| `src/app/` | Seiten und Routen (App Router) |
| `src/proxy.ts` | Läuft vor jeder Anfrage: CSP, Sicherheits-Header, Trennung von `APP_URL` und `PUBLIC_URL` |
| `src/server/config.ts` | Liest und prüft alle Umgebungsvariablen beim ersten Zugriff |
| `src/server/db/` | Drizzle-Schema und Client; jede fachliche Tabelle trägt `workspace_id` |
| `src/server/auth/` | Passwörter (Argon2id), Sitzungen, Rollen und Rechte (`rbac.ts`), OIDC (`oidc.ts`, `oidc-http.ts`) |
| `src/server/actions/` | Server Actions der Verwaltung |
| `src/server/api/` | REST-API: Token-Prüfung, OpenAPI-Beschreibung |
| `src/server/forms/`, `submissions/`, `files/`, `resume/`, `prefill/` | Fachlogik; jede Funktion ist auf den Workspace des Aufrufers begrenzt |
| `src/server/queue/`, `workflows/`, `webhooks/`, `mail/` | Dauerhafte Queue, Automationen, HMAC-Signaturen, Versand |
| `src/server/pdf/` | PDF-Erzeugung |
| `src/server/storage/` | Zugriff auf den S3-Speicher |
| `src/server/lib/` | Kryptografie, Ratenbegrenzung, SSRF-sicherer HTTP-Client, Logging ohne personenbezogene Daten |
| `src/worker/` | Worker-Prozess |
| `src/cli/` | Betriebs-Kommandozeile (Sicherung, Wiederherstellung, Notzugang) |
| `drizzle/` | SQL-Migrationen (`0000_init`, `0001_oidc`) |

## Formular-Engine

Dieselbe Engine läuft an zwei Orten. Im Browser liefert sie sofortiges Feedback (sichtbare Felder, Berechnungen, Fehlermeldungen). Auf dem Server prüft sie verbindlich: Werte verborgener und unbekannter Felder werden verworfen, Pflichtfelder und Formate erneut geprüft.

- **Antworten sind nach Feld-ID gespeichert**, nie nach Beschriftung. Umbenennen zerstört keine Daten.
- **Versionierung:** Der Editor arbeitet am Entwurf (`forms.draft`, mit Revisionszähler gegen gleichzeitiges Überschreiben). Veröffentlichen erzeugt eine unveränderliche Kopie in `form_versions`. Öffentlich gilt nur die veröffentlichte Version; jede Antwort verweist auf ihre Version.
- **Reguläre Ausdrücke** von Formularerstellern laufen mit RE2 (`re2js`, lineare Laufzeit) – kein ReDoS.

## Queue

Die Job-Queue liegt in PostgreSQL statt in einem eigenen Dienst wie Redis. Das spart einen Dienst, und die Jobs zu einer neuen Antwort entstehen in derselben Transaktion wie die Antwort selbst.

- Abholen mit `SELECT … FOR UPDATE SKIP LOCKED`; mehrere Worker sind möglich.
- Idempotenzschlüssel verhindern doppelte Jobs für dasselbe Ereignis.
- `pg_notify` weckt den Worker sofort nach dem Commit, zusätzlich fragt er alle 2 s ab.
- Fortschritt je Schritt in `jobs.progress`: erledigte Schritte laufen nach Absturz oder Wiederholung nicht erneut.
- Fälligkeit über die Datenbankzeit (`now()`), damit Uhrabweichungen zwischen App und Datenbank keine Rolle spielen.

Einzelheiten zu Wiederholungen und Absturzbehandlung: [Betrieb](25-betrieb-cli.md).

## Sicherheitsgrenzen

### `src/proxy.ts`

Läuft vor jeder Anfrage (ausgenommen statische Dateien und die Upload-Route, die Größe, Herkunft und Rate selbst prüft).

- **CSP mit Nonce** für jede Seite: `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `connect-src 'self'`. Deshalb sind alle Seiten dynamisch (`cacheComponents` ist aus).
- **API-Routen** erhalten `default-src 'none'; frame-ancestors 'none'; sandbox` und `cache-control: no-store` (außer öffentlichen Formularbildern).
- **Einbettung:** Nur `/f/…` und `/r/…` dürfen in iframes erscheinen, gesteuert über `EMBED_ORIGINS` (`frame-ancestors`). Alle anderen Pfade senden `X-Frame-Options: DENY` und `frame-ancestors 'none'`.
- Weitere Header: `X-Content-Type-Options: nosniff`, `Referrer-Policy` (`no-referrer` im öffentlichen Bereich), `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `X-Robots-Tag: noindex` für öffentliche Pfade, HSTS bei `https://`-`APP_URL`.

### `APP_URL` und `PUBLIC_URL`

Ist `PUBLIC_URL` gesetzt und hat einen anderen Host als `APP_URL`, liefert PLICA unter dem öffentlichen Host nur öffentliche Pfade (`/f/`, `/r/`, `/api/public/`, `/embed.js`, `/_next/`, `/favicon`, `/healthz`). Alles andere beantwortet der Proxy dort mit 404. Die Verwaltung ist über die Formular-Domain also nicht erreichbar. Formularlinks, QR-Codes, Vorbefüllungs- und Fortsetzungslinks bilden PLICA mit `PUBLIC_URL`, ohne diesen Wert mit `APP_URL`. Die OIDC-Rückleitung verwendet immer `APP_URL`.

### Weitere Grenzen

- **Workspace-Isolation:** Jede Abfrage der Fachlogik filtert nach dem Workspace des Aufrufers.
- **Rechte:** `src/server/auth/rbac.ts` ist die einzige Quelle für Berechtigungen. Server Actions und API-Routen prüfen dagegen; die Oberfläche blendet nur aus.
- **Uploads:** Inhaltsprüfung nach Dateisignatur, Größengrenze `UPLOAD_MAX_MB`, Ablage nur im Objektspeicher (nie im Webroot), Virenprüfung über ClamAV; ohne erreichbaren Scanner Quarantäne bis zur Freigabe.
- **Webhooks:** SSRF-sicherer Client (eigene DNS-Auflösung, alle Adressen geprüft, Verbindung auf die geprüfte IP festgelegt, Weiterleitungen erneut geprüft). Private Netze nur mit `WEBHOOK_ALLOW_PRIVATE=true`. Signatur per HMAC.
- **Verschlüsselung ruhender Geheimnisse** mit AES-GCM und einem aus `SECRET_KEY` abgeleiteten Schlüssel: TOTP-Geheimnisse, Zwischenstände, Webhook-Geheimnisse, OIDC-Zustand und ID-Tokens.

Die vollständige Zuordnung zu OWASP ASVS steht in [Sicherheit](../sicherheit/asvs.md).

## Anmeldung und Sitzungen

- **Passwort:** Hash mit Argon2id, Login-Drossel, optional TOTP als zweiter Faktor.
- **Sitzung:** Zufallstoken im Cookie, in der Datenbank nur als SHA-256-Hash. Gültig 14 Tage ab der letzten Nutzung. Nach der Anmeldung entsteht immer ein neues Token (Schutz vor Sitzungsfixierung).
- **Rollen** je Workspace: Inhaber, Administrator, Bearbeiter, Prüfer, Leser (`owner`, `admin`, `editor`, `reviewer`, `viewer`).
- **REST-API:** Bearer-Token; wirksam ist die Schnittmenge aus Scope des Tokens und aktueller Rolle des Besitzers.

### OIDC (`src/server/auth/oidc.ts`)

Aktiv, sobald `OIDC_ISSUER` gesetzt ist (Konfiguration: [Konfiguration](21-konfiguration.md)). Bibliothek: `openid-client`.

```
Browser ─► GET /api/auth/oidc/start?next=/pfad
             verschlüsseltes Zustands-Cookie (PKCE-Verifier, state, nonce, Ziel; 10 min)
        ─► Anbieter (z. B. authentik): Anmeldung, ggf. MFA
        ─► GET /api/auth/oidc/callback?code=…&state=…
             state prüfen → Code gegen Token tauschen (PKCE) → ID-Token-Signatur (JWKS), nonce
             → fehlende E-Mail/Gruppen über UserInfo → Konto zuordnen → Rolle abgleichen
             → neue PLICA-Sitzung (via_oidc) → Weiterleitung auf next
```

- **Ablauf:** Authorization Code mit PKCE (S256), vertraulicher Client, Discovery über `.well-known`. Die Redirect-URI ist fest `APP_URL` + `/api/auth/oidc/callback`, unabhängig von Proxy-Headern. In Produktion muss der Anbieter `https://` verwenden.
- **Kontozuordnung:** über das Subjekt `<issuer>|<sub>` (Spalte `users.oidc_subject`). Ein bestehendes Konto wird per E-Mail nur verknüpft, wenn der Anbieter `email_verified=true` meldet. Neue Konten entstehen nur mit `OIDC_AUTO_CREATE_USERS=true` und bestätigter E-Mail; sie haben kein Passwort.
- **Gruppen:** `OIDC_ALLOWED_GROUPS` begrenzt den Zugang (Admin-Gruppen zählen mit). `OIDC_ADMIN_GROUPS` ergibt die Rolle Administrator, sonst gilt `OIDC_DEFAULT_ROLE`. Die Rolle wird bei jeder Anmeldung im Standard-Workspace (dem ältesten) angeglichen; der letzte Inhaber wird nie herabgestuft.
- **Zweiter Faktor:** Bei SSO bringt der Anbieter die MFA mit; lokales TOTP gilt nur für die Passwort-Anmeldung.
- **Abmelden:** Mit `OIDC_LOGOUT=true` leitet PLICA nach dem Abmelden zum `end_session_endpoint` des Anbieters weiter. Dafür speichert die Sitzung das ID-Token verschlüsselt (`sessions.oidc_id_token`).
- **Fehler** enden nie als JSON, sondern als Weiterleitung auf `/login?fehler=<code>`; Einzelheiten nur im Log. Beide Routen sind ratenbegrenzt (30 Anfragen je Minute und IP).
- **Notzugang:** `LOCAL_LOGIN=hidden` blendet die Passwort-Anmeldung aus; erreichbar bleibt sie unter `/login?lokal=1`.

## Designsprache „Falz“

Die Oberfläche folgt der eigenen Designsprache „Falz“: Blätter auf einer Arbeitsfläche, Akzente wie Tinte und Textmarker. Die Farben stehen als CSS-Variablen in `src/app/globals.css` und werden über `@theme inline` als Tailwind-Farben (`bg-paper`, `text-stamp` …) bereitgestellt.

| Token | Bedeutung | Hell | Dunkel |
|---|---|---|---|
| `desk` | Arbeitsfläche (Aktengrau) | `#e7eae9` | `#101514` |
| `paper` | Blatt | `#fcfdfc` | `#1b2221` |
| `ink` | Text | `#18201e` | `#e8eeec` |
| `stamp` | Akzent, **Petrol** wie Füllertinte | `#0b5c66` | `#5fc2c9` |
| `marker` | **Textmarker**, nur für „hier sind Sie“ (aktive Navigation) und Textauswahl | `#ffe066` | `rgb(255 224 102 / 0.36)` |
| `ok`, `warn`, `bad` | Zustände | `#2f6b1e`, `#8f5800`, `#b42318` | `#8fd16f`, `#f0b45a`, `#ff8a7a` |

- Das dunkle Thema schaltet über `data-theme="dark"` am Wurzelelement.
- Laut Quelltext erreichen `muted` und `faint` in beiden Themen einen Kontrast von mindestens 4,5 : 1 auf `paper` und `desk`.
- Schriften (lokal eingebunden, kein externer Abruf): Hanken Grotesk (Text), Newsreader (Überschriften), IBM Plex Mono (Code und Kennungen).
- Die Klasse `.plica-marker` zeichnet einen schräg auslaufenden Leuchtstiftstrich; der „Falz“ markiert in Formularen den Seitenumbruch zwischen zwei Blättern.

PLICA verwendet bewusst nicht das Kanzlei-Designsystem, sondern eine eigene Produktidentität.

← [Betrieb](25-betrieb-cli.md) · weiter: [Tests](27-tests.md) →
