// Legt die lokale Entwicklungskonfiguration an (nur einmal, überschreibt nie).
// Alle Werte passen zu docker/compose.dev.yml und gelten ausschließlich lokal.
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const target = path.join(import.meta.dirname, "..", ".env.local");
if (existsSync(target)) {
  console.log("Lokale Konfiguration existiert bereits – nichts geändert.");
  process.exit(0);
}

const lines = [
  "# Lokale Entwicklung – keine echten Zugangsdaten. Erzeugt von pnpm dev:init.",
  "DATABASE_URL=postgres://plica:plica-dev-only@127.0.0.1:4732/plica",
  "APP_URL=http://localhost:4700",
  `SECRET_KEY=dev-only-${randomBytes(32).toString("hex")}`,
  "S3_ENDPOINT=http://127.0.0.1:4790",
  "S3_REGION=us-east-1",
  "S3_BUCKET=plica",
  "S3_ACCESS_KEY=plica-dev",
  "S3_SECRET_KEY=plica-dev-only-secret",
  "S3_FORCE_PATH_STYLE=true",
  "SMTP_URL=smtp://127.0.0.1:4725",
  'MAIL_FROM="PLICA <plica@localhost>"',
  "PLICA_ENV=development",
  "",
];
writeFileSync(target, lines.join("\n"), { mode: 0o600 });
console.log("Lokale Konfiguration angelegt (nur für die Entwicklung).");
