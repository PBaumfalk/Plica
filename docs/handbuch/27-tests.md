# 27 · Tests

## Übersicht

| Befehl | Was geprüft wird | Voraussetzung |
|---|---|---|
| `pnpm test` | Unit-Tests und Integrations-/Sicherheitstests (Vitest) gegen eine echte Datenbank `plica_test` und den Bucket `plica-test` | `pnpm dev:services` |
| `pnpm test:e2e` | Browser-Ende-zu-Ende (Playwright, Chromium) gegen einen frischen Produktions-Build auf Port 4711 mit Datenbank `plica_e2e`, Bucket `plica-e2e`, echtem Worker und Mailpit | `pnpm dev:services`, `pnpm exec playwright install chromium` |
| `scripts/docker-lifecycle-test.sh` (auch `pnpm test:lifecycle`) | Produktions-Image: Build, Start, Einrichtung, Einreichung mit Datei, Worker inkl. Wiederaufnahme nach Absturz, PDF, Sicherung, Totalverlust, Wiederherstellung | Docker, `openssl`, Playwright-Chromium |
| `pnpm docs:check` | Relative Links und Anker in `README.md` und `docs/` | – |
| `pnpm typecheck`, `pnpm lint` | TypeScript (strict) und ESLint | – |

**Aktueller Stand (23.10.2026):** `pnpm test` 242 Tests grün, dazu 4 übersprungen (der authentik-Test ohne `AUTHENTIK_URL`); `pnpm test:e2e` 10/10 grün.

Alle Tests laufen gegen die lokale Entwicklungsumgebung (`docker/compose.dev.yml`, Ports auf `127.0.0.1`). Sie berühren nie die Produktionsdaten.

## `pnpm test` – Unit und Integration

Vitest führt zwei Projekte aus (`vitest.config.ts`):

- **unit** (`tests/unit/`): Engine (Ausdrücke, Regeln, Validierung), Editor-Operationen, Formular-Erzeugung aus Beschreibungen und Feldvorschläge, Vorlagen, Export, PDF-Vorlagen, Webhook-Signaturen, OpenAPI, Logging ohne personenbezogene Daten, KI-Anbindung gegen einen nachgebauten Server sowie die Prüfung, dass jede Server Action eine Berechtigung prüft.
- **integration** (`tests/integration/`): gegen PostgreSQL und RustFS der Entwicklungsumgebung. Vor dem Lauf leert `global-setup.ts` die Datenbank `plica_test` (legt sie bei Bedarf an) und migriert sie. Die Dateien laufen nacheinander.

Abweichende Ziele setzen Sie über `TEST_DATABASE_URL`, `TEST_S3_ENDPOINT` und `QUEUE_TEST_DATABASE_URL`. Der Queue-Test nutzt eine eigene Datenbank `plica_test_queue`, damit keine anderen Tests Jobs abgreifen.

Einzelne Dateien:

```bash
pnpm test tests/integration/oidc.test.ts
pnpm test --project unit
```

### Integrations- und Sicherheitstests

| Datei | Inhalt |
|---|---|
| `authz.test.ts` | vollständige Rollenmatrix; Workspace-Isolation für Formulare und Antworten (Lesen, Ändern, Löschen, Veröffentlichen über fremde IDs); manipulierte IDs |
| `team.test.ts` | negative Berechtigungstests für Team, Einladungen und Workspaces |
| `public-submit.test.ts` | Pflichtfelder und Formate, verworfene Werte verborgener und unbekannter Felder, manipulierte, fremde und abgelaufene Tokens, Honeypot und Mindest-Ausfüllzeit, Idempotenz, fremde Datei-IDs, Pausieren und Limit, stabile veröffentlichte Version |
| `upload.test.ts` | Inhaltsprüfung (EXE als PDF, SVG, HTML), Feld- und Token-Prüfung, Größengrenze, Dateinamen ohne Path Traversal, Ablage im Objektspeicher |
| `primitives.test.ts` | AES-GCM, signierte Tokens, CSRF-Herkunft, Ratenbegrenzung, Login-Drossel, übergroße Requests, Slugs, Passwortrichtlinie, Argon2id |
| `client-ip.test.ts` | Ermittlung der Client-IP hinter dem Reverse Proxy (`TRUST_PROXY`) |
| `queue.test.ts` | dauerhafte Queue: Wiederaufnahme nach Fehler und Absturz ohne doppelte Schritte |
| `reliability.test.ts` | Regressionen aus der Zuverlässigkeitsprüfung |
| `retention.test.ts` | tägliche Bereinigung löscht genau das Abgelaufene; Uploads gültiger Fortsetzungslinks bleiben |
| `count.test.ts`, `forms-list.test.ts` | Zähler und Formularliste |
| `oidc.test.ts` | OIDC gegen einen nachgebauten Anbieter |
| `oidc-authentik.test.ts` | OIDC gegen ein echtes authentik (optional) |
| `oidc-setup.test.ts` | Keine SSO-Anmeldung vor der Ersteinrichtung |
| `workflow-retry.test.ts` | „Erneut versuchen“ setzt den Lauf fort und überspringt erledigte Schritte |
| `api-files.test.ts` | API liefert Quarantäne-Dateien erst nach Freigabe |

### `oidc.test.ts` – nachgebauter Anbieter

Der Test startet auf `127.0.0.1:4781` einen eigenen OIDC-Anbieter mit Discovery, JWKS (RSA-Schlüssel), Token- und UserInfo-Endpunkt sowie `end_session_endpoint`. Er braucht keine externe Software. Geprüft werden unter anderem:

- Authorization Code mit PKCE (S256), `state` und `nonce`; Redirect-URI aus `APP_URL`,
- Ergänzung von E-Mail und Gruppen aus UserInfo; UserInfo mit fremdem Subjekt wird abgelehnt,
- falsches `state`, falsche `nonce`, fremde Signatur, falsche Audience, fehlendes, manipuliertes oder abgelaufenes Zustands-Cookie, Fehler vom Anbieter, mehrfach eingelöster Code,
- Rücksprungziel bleibt in der Anwendung (kein offener Redirect),
- Abmelden beim Anbieter,
- Kontoanlage nur mit bestätigter E-Mail, Gruppenfilter, Verknüpfung per E-Mail nur bei `email_verified=true`, gesperrte Konten,
- Rollenabgleich bei jeder Anmeldung; der letzte Inhaber wird nie herabgestuft, auch nicht bei gleichzeitigen Anmeldungen.

### `oidc-authentik.test.ts` – echtes authentik

Dieser Test läuft nur, wenn `AUTHENTIK_URL` gesetzt ist; sonst überspringt Vitest ihn (die 4 übersprungenen Tests). Setzen Sie zusätzlich `AUTHENTIK_TOKEN`, ein API-Token mit Schreibrechten (zum Beispiel das Bootstrap-Token einer Testinstanz).

```bash
AUTHENTIK_URL=http://127.0.0.1:4785 AUTHENTIK_TOKEN=<token> pnpm test tests/integration/oidc-authentik.test.ts
```

Der Test legt in authentik Provider, Application, Gruppen, Scope-Zuordnung und Benutzer mit eindeutigem Präfix an, meldet sich per Chromium am echten Anmeldeformular an und gibt die Rückleitung an PLICA weiter. Er prüft Kontoanlage mit Standardrolle, Admin-Gruppe, Ablehnung bei unbestätigter E-Mail und bei fehlender Gruppe. Danach entfernt er alles Angelegte wieder. Verwenden Sie eine Testinstanz von authentik, nicht die produktive.

## `pnpm test:e2e` – Ende zu Ende

Playwright (`playwright.config.ts`) startet selbst zwei Prozesse:

1. `scripts/e2e-prepare.mjs` leert die Datenbank `plica_e2e` und den Bucket `plica-e2e` und migriert neu. Das Skript bricht ab, wenn der Datenbankname nicht „e2e“ enthält. Danach folgen `next build` (Ausgabe in `.next-e2e`) und `next start -p 4711`.
2. den Worker aus demselben Bundle wie im Image (`dist/worker.mjs`).

E-Mails gehen an Mailpit (`127.0.0.1:4725`). Mit `E2E_SKIP_BUILD=1` verwendet der Lauf einen vorhandenen Build.

| Projekt | Gerät | Abläufe |
|---|---|---|
| `setup` | Desktop 1440 × 900 | `00-setup`: Ersteinrichtung mit Einrichtungscode |
| `desktop` | Desktop 1440 × 900 | `01-builder`: Formular bauen, Logik, Moduswechsel, Veröffentlichen · `02-public`: Wizard mit Logik, Upload und Fehlern, stabile Version während Entwurfsänderungen, geschlossene und unbekannte Formulare · `03-responses`: E-Mail über Mailpit, Antwortansicht, PDF, CSV/XLSX · `04-permissions`: fremder Workspace, Leserolle, Zugriff ohne Anmeldung |
| `mobile` | iPhone 13 (Chromium) | `mobile`: Kartenmodus ausfüllen und absenden · `layout-mobile`: kein seitlicher Überlauf mit allen Feldtypen in Classic und Wizard |

Zusammen sind das 10 Tests.

```bash
pnpm test:e2e
pnpm test:e2e --project=desktop
```

## `scripts/docker-lifecycle-test.sh` – Produktions-Image

Der Test baut das Image als `plica:local` (ein vorhandenes Image mit diesem Tag wird ersetzt) und startet `compose.yml` als eigenes Compose-Projekt `plica-lifecycle` auf Port 4765 (`PORT=…` ändert ihn). Konfiguration und Schlüssel erzeugt er zufällig in einem temporären Ordner. Andere Compose-Projekte bleiben unberührt.

Ablauf: Start und `/healthz` → Einrichtung über die Oberfläche → Formular mit Upload und PDF-Automation anlegen → Einreichung mit PDF-Datei bei angehaltenem Worker → Absturz simulieren (Job hängt als `running` eines toten Workers) → Worker starten, Wiederaufnahme und PDF prüfen → `plica backup` und `plica verify` → Totalverlust (Schemas gelöscht) → `plica restore` → Antwort und Datei inhaltsgleich zurück.

```bash
scripts/docker-lifecycle-test.sh
KEEP=1 scripts/docker-lifecycle-test.sh     # Projekt nach dem Lauf nicht abbauen
```

Ohne `KEEP=1` entfernt der Test am Ende sein Projekt samt Volumes.

← [Architektur](26-architektur.md) · weiter: [Bekannte Einschränkungen](28-bekannte-einschraenkungen.md) →
