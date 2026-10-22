/**
 * Ersteinrichtung ohne Standardpasswort: Solange kein Konto existiert,
 * erzeugt PLICA einen Einrichtungscode und schreibt ihn ins Server-Log.
 * Nur wer Zugriff auf den Server hat, kann das erste Konto anlegen.
 */
import "server-only";
import { count, eq } from "drizzle-orm";
import { randomInt } from "node:crypto";
import { config } from "./config";
import { db, schema } from "./db";

export async function needsSetup(): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  return n === 0;
}

function freshCode() {
  const part = () => String(randomInt(1000, 10000));
  return `${part()}-${part()}-${part()}`;
}

export async function setupCode(): Promise<string> {
  if (config().SETUP_CODE) return config().SETUP_CODE!;
  const row = await db.query.meta.findFirst({ where: eq(schema.meta.key, "setup_code") });
  if (row) return row.value;
  const code = freshCode();
  await db.insert(schema.meta).values({ key: "setup_code", value: code }).onConflictDoNothing();
  return (await db.query.meta.findFirst({ where: eq(schema.meta.key, "setup_code") }))!.value;
}

export async function announceSetupCode() {
  if (!(await needsSetup())) return;
  const code = await setupCode();
  const line = "─".repeat(64);
  console.warn(`\n${line}\n  PLICA ist noch nicht eingerichtet.\n  Einrichtungscode: ${code}\n  Öffnen Sie ${config().APP_URL}/einrichten und geben Sie den Code ein.\n${line}\n`);
}

export async function consumeSetupCode() {
  await db.delete(schema.meta).where(eq(schema.meta.key, "setup_code"));
}
