/**
 * PLICA-Kommandozeile für den Betrieb.
 *   plica backup | backups | verify <datei> | restore <datei> --yes
 *   plica setup-code | reset-password <email> | health
 * Im Container: `docker compose exec app plica <befehl>`.
 */
import { createBackup, listBackups, restoreBackup, rotateBackups, verifyBackup } from "./backup";

const [cmd, ...args] = process.argv.slice(2);

function usage(): never {
  console.log(`PLICA – Betriebsbefehle

  plica backup [--auto]        Sicherung von Datenbank und Dateien anlegen
  plica backups                Vorhandene Sicherungen auflisten
  plica verify <datei>         Sicherung auf Vollständigkeit prüfen
  plica restore <datei> --yes  Sicherung wiederherstellen (überschreibt alle Daten!)
  plica setup-code             Einrichtungscode anzeigen (nur vor der Einrichtung)
  plica reset-password <email> Neues Passwort für ein Konto setzen
  plica health                 Gesundheitsprüfung der laufenden Anwendung`);
  process.exit(cmd ? 1 : 0);
}

const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

async function main() {
  switch (cmd) {
    case "backup": {
      const auto = args.includes("--auto");
      const file = await createBackup(auto ? "auto" : "manuell");
      if (auto) await rotateBackups();
      console.log(`Sicherung erstellt und geprüft: ${file}`);
      return;
    }
    case "backups": {
      const list = await listBackups();
      if (!list.length) return console.log("Keine Sicherungen vorhanden.");
      for (const b of list) console.log(`${b.mtime.toISOString()}  ${fmtSize(b.size).padStart(9)}  ${b.file}`);
      return;
    }
    case "verify": {
      if (!args[0]) usage();
      const m = await verifyBackup(args[0]);
      console.log(`Sicherung in Ordnung: vom ${m.createdAt}, Datenbank ${fmtSize(m.database.size)}, ${m.objects.length} Dateien.`);
      return;
    }
    case "restore": {
      if (!args[0]) usage();
      if (!args.includes("--yes")) {
        console.error("Die Wiederherstellung ersetzt ALLE aktuellen Daten. Zum Bestätigen --yes anhängen.\nTipp: vorher `plica backup` ausführen.");
        process.exit(2);
      }
      const m = await restoreBackup(args[0]);
      if (m.safetyBackup) console.log(`Vorheriger Stand gesichert: ${m.safetyBackup}`);
      console.log(`Wiederhergestellt: Stand vom ${m.createdAt}, ${m.objects.length} Dateien. Bitte die Anwendung neu starten (docker compose restart app worker).`);
      return;
    }
    case "setup-code": {
      const { needsSetup, setupCode } = await import("@/server/setup");
      if (!(await needsSetup())) return console.log("PLICA ist bereits eingerichtet.");
      console.log(`Einrichtungscode: ${await setupCode()}`);
      return;
    }
    case "reset-password": {
      const email = args[0]?.toLowerCase();
      if (!email) usage();
      const { db, schema } = await import("@/server/db");
      const { hashPassword } = await import("@/server/auth/password");
      const { randomToken } = await import("@/server/lib/crypto");
      const { audit } = await import("@/server/audit");
      const { eq, sql } = await import("drizzle-orm");
      const user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
      if (!user) {
        console.error("Kein Konto mit dieser E-Mail-Adresse.");
        process.exit(1);
      }
      const pw = randomToken(15);
      await db.update(schema.users).set({ passwordHash: await hashPassword(pw) }).where(eq(schema.users.id, user.id));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
      await audit({ userId: user.id, action: "password.reset_cli" });
      console.log(`Neues Passwort für ${user.email}: ${pw}\nAlle Sitzungen wurden beendet. Bitte nach der Anmeldung ändern.`);
      return;
    }
    case "health": {
      const port = process.env.PORT ?? "3000";
      const r = await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null);
      const body = r ? await r.text() : "keine Antwort";
      console.log(body);
      process.exit(r?.ok ? 0 : 1);
    }
    default:
      usage();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(`Fehler: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
