# PLICA – selbst gehostete Formularplattform

- Baumfalk-UI Designsystem: **Nein**. Patrick wünscht eine eigenständige Produktidentität (Entscheidung 22.10.2026). Nicht erneut fragen.
- Referenzen (nur lesen, nie ändern): Filum `../link-shortener`, Tessera `../QR-Code-Wizard`.
- Stack: Next.js 16 (App Router, `cacheComponents` aus), React 19, TypeScript strict, Tailwind 4, Drizzle + PostgreSQL 18, S3 (RustFS; MinIO-Images sind nicht mehr öffentlich), Mailpit (nur Dev), Worker-Prozess mit Postgres-Queue.
- Architektur: `docs/handbuch/26-architektur.md`, Sicherheit `docs/sicherheit/asvs.md`. Formular-Engine (isomorph, ohne DOM/DB): `src/lib/forms/`.
- Dev: `pnpm dev:init` (einmalig), `pnpm dev:services`, `pnpm db:migrate`, `pnpm dev`, `pnpm worker`. Ports 47xx, alles auf 127.0.0.1. Befehle nie mit `.env*` im Text aufrufen (Secret-Hook) – immer über pnpm-Skripte.
- Tests: `pnpm test` (Unit + Integration gegen DB `plica_test`), `pnpm test:e2e` (Produktions-Build, DB `plica_e2e`, Port 4711), `scripts/docker-lifecycle-test.sh` (Image, Backup/Restore). Browser-Prüfung per Playwright (`.scratch/`), Chrome-Erweiterung war nicht verbunden.
- Zeiten in der UI immer über `TimeAgo` / `dateTime()` (feste Zone Europe/Berlin), sonst Hydration-Fehler.
- Keine echten Secrets ins Repo. `.env.local` ist nur für Dev.
