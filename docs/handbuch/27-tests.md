# 27 · Tests

| Befehl | Was geprüft wird | Voraussetzung |
|---|---|---|
| `pnpm test` | Unit-Tests (Engine, Export, PDF-Vorlagen, Webhooks …) und Integrations-/Sicherheitstests gegen eine echte Datenbank `plica_test` | `pnpm dev:services` |
| `pnpm test:e2e` | Browser-Ende-zu-Ende (Chromium, Desktop 1440 px und iPhone 13) gegen eine frische Produktions-Instanz auf Port 4711 mit Datenbank `plica_e2e` und Worker | `pnpm dev:services`, `npx playwright install chromium` |
| `scripts/docker-lifecycle-test.sh` | Produktions-Image: Build, Start, Einrichtung, Einreichung mit Datei, Worker inkl. Wiederaufnahme nach Absturz, Sicherung, Totalverlust, Wiederherstellung | Docker |
| `pnpm docs:check` | Relative Links und Anker in README und `docs/` | – |
| `pnpm typecheck`, `pnpm lint` | TypeScript (strict) und ESLint | – |

## Sicherheitstests (`tests/integration/`)

- `authz.test.ts`: vollständige Rollenmatrix; Workspace-Isolation für Formulare und Antworten (Lesen, Ändern, Löschen, Veröffentlichen über fremde IDs); manipulierte IDs.
- `public-submit.test.ts`: Pflichtfelder und Formate, verworfene Werte verborgener und unbekannter Felder, manipulierte/fremde/abgelaufene Tokens, Honeypot und Mindest-Ausfüllzeit, Idempotenz, fremde Datei-IDs, Pausieren und Limit, stabile veröffentlichte Version.
- `upload.test.ts`: Inhaltsprüfung (EXE als PDF, SVG, HTML), Feld- und Token-Prüfung, Größengrenze, Dateinamen ohne Path Traversal, Ablage im Objektspeicher.
- `primitives.test.ts`: AES-GCM, signierte Tokens, CSRF-Herkunft, Ratenbegrenzung, Login-Drossel, übergroße Requests, Slugs, Passwortrichtlinie und Argon2id.

## E2E-Abläufe (`tests/e2e/`)

`00-setup` Ersteinrichtung · `01-builder` Formular bauen, Drag-and-drop, Moduswechsel, Veröffentlichen · `02-public` Wizard mit Logik, Fehlern, Upload, Speicherung, stabile Version, geschlossene Formulare · `mobile` Cards-Modus auf dem iPhone · `03-responses` E-Mail über Mailpit, Antwortansicht, PDF, CSV/XLSX · `04-permissions` fremder Workspace, Leserolle, ohne Anmeldung.

Der E2E-Lauf leert die Datenbank `plica_e2e` und den Bucket `plica-e2e` vor jedem Start (`scripts/e2e-prepare.mjs` bricht ab, wenn der Datenbankname nicht „e2e“ enthält).

← [Architektur](26-architektur.md) · weiter: [Bekannte Einschränkungen](28-bekannte-einschraenkungen.md) →
