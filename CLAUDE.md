# PLICA – selbst gehostete Formularplattform

- Baumfalk-UI Designsystem: **Nein**. Patrick wünscht eine eigenständige Produktidentität (Entscheidung 22.10.2026). Nicht erneut fragen.
- Referenzen (nur lesen, nie ändern): Filum `../link-shortener`, Tessera `../QR-Code-Wizard`.
- Stack: Next.js 16 (App Router, `cacheComponents` aus), React 19, TypeScript strict, Tailwind 4, Drizzle + PostgreSQL 18, MinIO/S3, Mailpit (nur Dev), Worker-Prozess mit Postgres-Queue.
- Architektur und Verträge: `docs/ARCHITEKTUR.md`. Formular-Engine (isomorph, ohne DOM/DB): `src/lib/forms/`.
- Dev: `pnpm dev:services` (Compose), `pnpm db:migrate`, `pnpm dev`, `pnpm worker`. Ports 47xx, alles auf 127.0.0.1.
- Tests: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright).
- Keine echten Secrets ins Repo. `.env.local` ist nur für Dev.
