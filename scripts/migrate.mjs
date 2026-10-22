// Führt ausstehende Migrationen aus. Läuft ohne Build-Werkzeuge (auch im Container).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
try {
  await migrate(drizzle({ client: sql }), { migrationsFolder: dir });
  console.log("Migrationen ausgeführt.");
} catch (e) {
  console.error("Migration fehlgeschlagen:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
