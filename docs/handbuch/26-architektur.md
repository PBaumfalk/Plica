# 26 · Architektur

## Bausteine

```
Browser ──► Reverse Proxy (TLS) ──► app (Next.js 16, Node 24)
                                      │  proxy.ts: CSP mit Nonce, Sicherheits-Header,
                                      │            Trennung APP_URL / PUBLIC_URL
                                      ├─ Server Components + Server Actions (Verwaltung)
                                      ├─ /api/public/*  (öffentliche Formulare: Absenden, Upload, Ereignisse)
                                      ├─ /api/v1/*      (REST-API mit Bearer-Token)
                                      └─ /healthz
                     worker (Node 24) ─► Job-Queue in PostgreSQL ─► SMTP, Webhooks, PDF
              PostgreSQL 18  ◄────────┤
              S3-Speicher    ◄────────┘  (Uploads, Unterschriften, PDFs; nie im Webroot)
```

## Module im Quelltext

| Ordner | Verantwortung |
|---|---|
| `src/lib/forms/` | **Formular-Engine**, isomorph (Browser und Server): Schema (Zod), Feldtypen, Ausdruckssprache für Berechnungen (eigener Parser, kein `eval`), Regel-Engine, Validierung, statische Analyse (Zyklen, unmögliche Regeln, ungültige Verweise), Formatierung. |
| `src/components/form/` | Renderer für Classic, Cards und Wizard; Eingabekomponenten aller Feldtypen. |
| `src/components/builder/` | Visueller Editor. |
| `src/server/db/` | Drizzle-Schema und Client. Jede fachliche Tabelle trägt `workspace_id`. |
| `src/server/auth/` | Passwörter (Argon2id), Sitzungen, Rollen und Rechte (`rbac.ts`). |
| `src/server/forms/`, `submissions/`, `files/` | Fachlogik; jede Funktion ist auf den Workspace des Aufrufers begrenzt. |
| `src/server/queue/`, `workflows/`, `webhooks/`, `mail/` | Dauerhafte Queue, Workflow-Engine, HMAC-Signaturen, Versand. |
| `src/server/pdf/` | PDF-Erzeugung. |
| `src/worker/` | Worker-Prozess. |
| `src/cli/` | Betriebs-Kommandozeile (Sicherung, Wiederherstellung). |

## Zentrale Entscheidungen

- **Antworten sind nach Feld-ID gespeichert**, nie nach Beschriftung. Umbenennen zerstört keine Daten.
- **Versionierung**: Der Editor arbeitet am Entwurf (`forms.draft`, mit Revisionszähler gegen gleichzeitiges Überschreiben). Veröffentlichen erzeugt eine unveränderliche Kopie (`form_versions`). Öffentlich gilt nur die veröffentlichte Version; jede Antwort verweist auf ihre Version.
- **Eine Engine, zwei Orte**: Logik und Validierung laufen im Browser für sofortiges Feedback und auf dem Server verbindlich. Antworten verborgener Felder werden serverseitig verworfen.
- **Reguläre Ausdrücke** von Formularerstellern laufen mit RE2 (`re2js`, lineare Laufzeit) – kein ReDoS.
- **Queue in PostgreSQL** (`SELECT … FOR UPDATE SKIP LOCKED`, Idempotenzschlüssel, Fortschritt je Schritt) statt Redis: ein Dienst weniger, transaktional mit den Daten.
- **Kein Cache-Components-Modell**: alle Seiten sind benutzerbezogen und dynamisch; das erlaubt eine strikte CSP mit Nonce.
- **Speicher**: S3-kompatibel. Im Compose-Stack RustFS, weil MinIO seine Images nicht mehr öffentlich verteilt.

← [Betrieb](25-betrieb-cli.md) · weiter: [Tests](27-tests.md) →
