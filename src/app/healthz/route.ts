/**
 * Gesundheitsprüfung für Docker/Reverse Proxy: Datenbank und Objektspeicher.
 * Gibt keine Details preis, nur ok/fehler je Komponente.
 */
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { scannerStatus } from "@/server/files/scan";
import { storageHealthy } from "@/server/storage/s3";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await db
    // Nicht nur Verbindung, auch Schema: nach einer gescheiterten Wiederherstellung wäre es leer
    .execute(sql`select 1 from users limit 1`)
    .then(() => true)
    .catch(() => false);
  const [storageOk, scanner] = await Promise.all([storageHealthy(), scannerStatus()]);
  // Der Virenscanner ist optional: ohne ihn bleiben Uploads in Quarantäne – kein Grund für „ungesund“
  const ok = dbOk && storageOk;
  return Response.json(
    { status: ok ? "ok" : "fehler", database: dbOk ? "ok" : "fehler", storage: storageOk ? "ok" : "fehler", virusScanner: scanner },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
