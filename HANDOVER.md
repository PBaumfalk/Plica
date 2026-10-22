# HANDOVER – PLICA

## Stand 22.10.2026 (zweiter Durchgang: Abnahme)

### Erledigt
- Unabhängige Prüfung durch 6 Agenten (UX, Funktion, Sicherheit, Zuverlässigkeit, Pentest, Abnahme), Befunde behoben und in 2 Runden unabhängig nachgetestet. Bericht mit Go/No-Go: `docs/abnahme-2026-10-22.md`.
- Tests: 221/221 Unit/Integration (3× stabil), 10/10 E2E, Docker-Lebenszyklus bestanden, Audit ohne Funde.

### Offen
- Deployment auf Netcup hinter TLS-Proxy, echter SMTP-Provider, externe Backups, Monitoring, DSGVO-Unterlagen (siehe Bericht, Abschnitt Go/No-Go).
- Prüfumgebungen: Projekt `plica-acc` läuft noch (Port 3400); `plica-qa/ux/rel` gestoppt, Volumes vorhanden. Prüfkonfigurationen liegen in `.scratch/*.vars` (lokale Zufallsschlüssel).

### Nächster Schritt
- Zielserver vorbereiten und Pilot mit 1–2 unkritischen Formularen. Fällig: offen.

---

## Stand 22.10.2026

### Erledigt
- Formular-Engine `src/lib/forms/` (30 Feldtypen, Regeln, Formeln ohne eval, RE2-Validierung, Analyse auf Zyklen/Widersprüche) – isomorph, Server prüft verbindlich.
- Editor `/formulare/[id]/bearbeiten` (Drag-and-drop, Regel-Editor, Undo/Redo, Autosave mit Konfliktschutz, Bausteine, Versionen, Vorschau).
- Öffentliche Formulare Classic/Cards/Wizard, Uploads mit Inhaltsprüfung und Quarantäne, Unterschrift (einfache elektronische Signatur), Passwort, Limit, Fristen, Einbettung, QR, Fortsetzungs- und Folgeformular-Links.
- Antworten (Tabelle, Detail, Notizen, Tags, Verlauf, Ansichten), CSV/XLSX/JSON, PDF mit Vorlageneditor, geschützte Downloads.
- Worker mit dauerhafter Queue (Wiederaufnahme ohne doppelte Schritte), E-Mail, HMAC-Webhooks (SSRF-sicher), Freigaben, REST-API mit OpenAPI.
- Team/Rollen/Einladungen, Workspaces, TOTP, Protokoll; Einrichtung per Einrichtungscode.
- Docker-Image, `compose.yml` (gehärtet, nur 127.0.0.1), Backup/Restore-CLI, Handbuch (25 Dateien), ASVS-Zuordnung, Datenschutz-Doku.

### Geprüft (22.10.2026)
- `pnpm test`: 131 Tests grün (Unit + Integration inkl. IDOR, Rollenmatrix, Upload-Tarnung, Queue-Absturz, Aufbewahrung).
- `pnpm test:e2e`: 8/8 grün (Desktop + iPhone, Produktions-Build, echter Worker, Mailpit, PDF, Export, Berechtigungen).
- `scripts/docker-lifecycle-test.sh`: bestanden (Build → Einrichtung → Einreichung → Worker-Absturz → Backup → Totalverlust → Restore).
- `pnpm audit --prod`: keine bekannten Schwachstellen. tsc und Lint sauber.

### Offen / nicht real getestet
- Virenprüfung mit echtem ClamAV (Profil vorhanden, nie gegen echten Scanner gelaufen).
- E-Mail-Fehlerpfade mit echten SMTP-Fehlercodes; Versand des Fortsetzungslinks per Mail.
- Löschen eines Workspace und „Inhaberschaft übertragen“ nur per Integrationstest, nicht im Browser.
- Betrieb auf dem Netcup-Server (keine SSH-Verbindung hergestellt – bewusst).
- Dev-Datenbank enthält viele Testformulare der Entwicklung (Workspace „Kanzlei Musterstadt“, Konto admin@plica.test).

### Entscheidungen Patrick
- Kein Baumfalk-UI, eigene Designsprache „Falz“.

### Nächster Schritt
- Selbst ausprobieren (Produktions-Compose lokal starten, Einrichtungscode aus dem Log), danach Zielserver und Domain für Formulare (PUBLIC_URL) festlegen. Fällig: offen.

### Uncommittet
- nichts
