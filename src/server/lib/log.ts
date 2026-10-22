/**
 * Fehler protokollieren, ohne personenbezogene Daten preiszugeben.
 * Drizzle hängt an Datenbankfehler die eingesetzten Parameter an („params: …“) –
 * das wären Antwortinhalte. Ins Log kommen nur Art, Code, Constraint und Tabelle.
 */
type PgLike = { name?: string; message?: string; code?: string; constraint_name?: string; table_name?: string; cause?: unknown };

export function safeError(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  let cur = e as PgLike | undefined;
  for (let i = 0; cur && i < 4; i++, cur = cur.cause as PgLike | undefined) {
    if (cur.code && !out.code) out.code = String(cur.code);
    if (cur.constraint_name && !out.constraint) out.constraint = cur.constraint_name;
    if (cur.table_name && !out.table) out.table = cur.table_name;
    if (i === 0) {
      out.name = cur.name ?? "Error";
      // Nur die erste Zeile, ohne Abfrageparameter
      out.message = String(cur.message ?? "").split("\n")[0].replace(/params:[\s\S]*$/, "").slice(0, 300);
    }
  }
  return out;
}

export function logError(scope: string, e: unknown) {
  console.error(`[${scope}]`, JSON.stringify(safeError(e)));
}
