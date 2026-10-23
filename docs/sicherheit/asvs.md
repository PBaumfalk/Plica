# Sicherheit: Abgleich mit OWASP ASVS 5.0.0

PLICA verarbeitet auch anwaltliche und andere vertrauliche Daten. Dieses Dokument ordnet die relevanten Kapitel des **OWASP Application Security Verification Standard 5.0.0** der Umsetzung und den Testnachweisen zu.

**Lesart.** Der Abgleich erfolgt auf Ebene der ASVS-Kapitel und -Abschnitte, nicht Anforderung für Anforderung. Er ist eine Selbsteinschätzung des Entwicklungsteams, kein Audit und keine Zertifizierung. Zielniveau ist Level 2 für die genannten Abschnitte.

Status: **umgesetzt + getestet** (automatisierter Test vorhanden) · **umgesetzt** (im Code, ohne eigenen Test) · **teilweise** · **Betreiber** (liegt beim Betrieb) · **n. a.** (nicht anwendbar)

| ASVS-Abschnitt | Umsetzung in PLICA | Status | Nachweis |
|---|---|---|---|
| **V1 Kodierung und Bereinigung** – Ausgabe-Kodierung, Injection | React kodiert alle Ausgaben; kein `dangerouslySetInnerHTML` für Nutzerinhalte (einzige Ausnahme: festes Theme-Skript mit Nonce). Datenbankzugriff nur über Drizzle mit Parametern. Formeln über eigenen Parser, kein `eval`. CSV/XLSX-Export entschärft Formelinjektion. | umgesetzt + getestet | `tests/unit/engine.test.ts` (Ausdrücke lehnen Code ab), `tests/unit/export.test.ts`, `tests/integration/authz.test.ts` (manipulierte IDs) |
| **V2 Validierung und Geschäftslogik** | Jede Einreichung wird serverseitig gegen die veröffentlichte Version validiert (Typen, Pflicht, Optionen, Grenzen, Logik). Verborgene und unbekannte Felder werden verworfen. Limits und Zeitfenster atomar in der Transaktion. Reguläre Ausdrücke über RE2 (kein ReDoS). | umgesetzt + getestet | `tests/integration/public-submit.test.ts`, `tests/unit/engine.test.ts` (ReDoS) |
| **V3 Web-Frontend-Sicherheit** – CSP, Header, Cookies, Einbettung | Strikte CSP mit Nonce und `strict-dynamic`; `frame-ancestors 'none'` für die Verwaltung, konfigurierbar für Formulare; `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS bei https. Cookies `HttpOnly`, `SameSite=Lax`, `Secure` und `__Host-`-Präfix bei https. | umgesetzt | `src/proxy.ts`, `src/server/auth/session.ts`; manuell per `curl -I` geprüft |
| **V3 – CSRF** | Server Actions prüfen den Origin (Next.js). Öffentliche POST-Routen prüfen `Origin`/`Sec-Fetch-Site`. Cookies `SameSite=Lax`. | umgesetzt + getestet | `tests/integration/primitives.test.ts` (CSRF-Herkunft) |
| **V4 API und Webdienste** | REST-API `/api/v1` mit Bearer-Tokens (nur Hash gespeichert, Scope ∩ Rolle), OpenAPI-Beschreibung, `Cache-Control: no-store`, Größenlimits für Request-Bodys. | umgesetzt (Tests im API-Bereich) | `src/server/api/auth.ts`, `tests/integration/primitives.test.ts` (übergroße Requests) |
| **V5 Dateiverarbeitung** | Größenlimit vor dem Lesen; Typ per Inhaltsanalyse (Magic Bytes), nicht per Endung; SVG/HTML abgelehnt; Dateiname bereinigt, Speicherschlüssel nur serverseitig; Ablage außerhalb des Webroots im Objektspeicher; Virenprüfung (ClamAV) oder Quarantäne mit bewusster Freigabe; Download nur nach Rechteprüfung, als Anhang, mit `nosniff`. | umgesetzt + getestet | `tests/integration/upload.test.ts`, `tests/integration/public-submit.test.ts` (fremde Datei-IDs) |
| **V6 Authentifizierung** – Passwörter, Brute Force, MFA | Mindestens 10 Zeichen, Prüfung gegen verbreitete Passwörter und E-Mail-Namen; Argon2id (OWASP-Parameter); gleiche Laufzeit bei unbekanntem Konto; Drossel nach 5 Fehlversuchen (exponentiell bis 15 min) je Konto und IP; TOTP mit einmaligen Wiederherstellungscodes; kein Standardpasswort (Einrichtungscode). | umgesetzt + getestet | `tests/integration/primitives.test.ts` (Passwortrichtlinie, Argon2id, Drossel), `tests/e2e/00-setup.spec.ts` |
| **V7 Sitzungsverwaltung** | Zufälliges 256-bit-Token, in der DB nur SHA-256; 14 Tage gleitend; Abmelden löscht serverseitig; Passwortwechsel beendet andere Sitzungen; MFA-Zwischensitzung 10 min; Sitzungsliste mit Abmelden einzelner Geräte. SSO-Sitzungen können beim Abmelden auch beim Anbieter beendet werden (`id_token_hint`, verschlüsselt gespeichert). | umgesetzt | `src/server/auth/session.ts` |
| **V8 Autorisierung** | Zentrale Rechtematrix (`rbac.ts`), Prüfung in jeder Server Action und Route; jede Abfrage auf den Workspace des Aufrufers begrenzt (kein IDOR); Admins können keine Admin-/Inhaberrechte vergeben. | umgesetzt + getestet | `tests/integration/authz.test.ts`, `tests/e2e/04-permissions.spec.ts` |
| **V9 Eigenständige Tokens** | Signierte Kurz-Tokens (HMAC-SHA256, zweckgebunden, mit Ablauf) für Formularsitzungen, Freischaltung geschützter Formulare, Vorbefüllung. | umgesetzt + getestet | `tests/integration/primitives.test.ts`, `tests/integration/public-submit.test.ts` |
| **V10 OAuth/OIDC** | Optionale Anmeldung über OIDC (Relying Party): Authorization Code mit PKCE (S256), vertraulicher Client, Discovery; state und nonce werden geprüft, ID-Token-Signatur immer über JWKS (`enableNonRepudiationChecks`), Audience und Issuer durch openid-client. Zustand (Verifier, state, nonce, Rücksprung) AES-GCM-verschlüsselt in einem 10-min-Cookie (`HttpOnly`, `SameSite=Lax`, Pfad `/api/auth/oidc`), einmalig. Redirect-URI fest aus `APP_URL`; Rücksprungziele nur relative Pfade. Zuordnung über Issuer + `sub`; Verknüpfung per E-Mail nur bei `email_verified=true`. UserInfo nur mit passendem `sub`. Neue Sitzung mit frischem Token (keine Sitzungsfixierung). In Produktion nur `https://`-Issuer. | umgesetzt + getestet | `tests/integration/oidc.test.ts` (nachgebauter Anbieter: PKCE, state, nonce, fremde Signatur, falsche Audience, Code-Wiederverwendung, Rücksprungziele, Konten, Rollen), `tests/integration/oidc-authentik.test.ts` (echtes authentik 2026.8.5) |
| **V11 Kryptografie** | AES-256-GCM für TOTP-Geheimnisse, Zwischenstände, Webhook-Geheimnisse; Schlüssel per HKDF zweckgetrennt aus `SECRET_KEY`; `crypto.randomBytes`/`randomInt` für alle Zufallswerte; zeitkonstante Vergleiche. | umgesetzt + getestet | `tests/integration/primitives.test.ts` |
| **V12 Sichere Kommunikation** | TLS durch Reverse Proxy; HSTS bei https; Webhooks über SSRF-sicheren Client (DNS-Pinning, private Netze gesperrt, jede Weiterleitung geprüft). | teilweise (TLS: Betreiber) | `src/server/lib/safefetch.ts`, [Reverse Proxy](../handbuch/22-reverse-proxy.md) |
| **V13 Konfiguration** – Secrets, Abhängigkeiten, Härtung | Alle Geheimnisse aus Umgebungsvariablen, keine im Repository; Prüfung beim Start; Entwicklungsschlüssel in Produktion abgelehnt; Container ohne Root, schreibgeschützt, ohne Capabilities; Datenbank und Speicher ohne Host-Ports im internen Netz; `pnpm audit` im Qualitätsprozess. | umgesetzt | `compose.yml`, `Dockerfile`, `src/server/config.ts`, `scripts/docker-lifecycle-test.sh` |
| **V14 Datenschutz** | Aufbewahrungsfristen mit endgültiger Löschung inkl. Dateien; keine IP-Adressen im Klartext; anonyme Analyse ohne Cookies; Datenexport; `no-store` für API-Antworten; `noindex` für Formulare. | umgesetzt | `src/server/queue/retention.ts`, [Datenschutz](../datenschutz.md) |
| **V15 Sicheres Programmieren und Architektur** | TypeScript strict, Zod an allen Eingangsgrenzen, `server-only` für Servermodule, isomorphe Engine mit Tests, Idempotenz bei Einreichung und Jobs. | umgesetzt + getestet | `pnpm typecheck`, `pnpm test` |
| **V16 Protokollierung und Fehlerbehandlung** | Audit-Log für Anmeldungen, Fehlversuche, Rechte, Exporte, Löschungen; keine Passwörter, Tokens oder Antwortinhalte im Log; Fehler an Nutzer ohne technische Details, Details nur im Server-Log. | umgesetzt | `src/server/audit.ts`, `src/server/actions/result.ts` |
| **V17 WebRTC** | – | n. a. | – |

## Offene Punkte

- Ratenbegrenzung liegt im Speicher einer App-Instanz (siehe [Bekannte Einschränkungen](../handbuch/28-bekannte-einschraenkungen.md)).
- Kein externer Penetrationstest. Für den Einsatz mit Mandantendaten empfehlen wir eine unabhängige Prüfung.
- Sitzungstests laufen bisher über die E2E-Suite (Anmeldung, Abmeldung, fehlende Sitzung), nicht als eigene Integrationstests.

## Sicherheitstests ausführen

```bash
pnpm dev:services
pnpm test        # enthält tests/integration/*
pnpm test:e2e    # enthält Berechtigungs-Ende-zu-Ende-Tests
```
