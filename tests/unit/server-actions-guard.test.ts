/**
 * Jede Server Action ist von außen per POST aufrufbar. Dieser Test stellt sicher,
 * dass jede exportierte Action eine Berechtigung prüft (assertViewer("…")) –
 * oder bewusst als öffentlich bzw. „nur angemeldet“ eingestuft ist.
 * Eine neue Action ohne Prüfung lässt diesen Test scheitern.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.resolve(__dirname, "../../src/server/actions");

/** Ohne Anmeldung erreichbar – prüfen ihre Eingaben selbst (Code, Passwort, Token). */
const PUBLIC = new Set([
  "auth.checkSetupCode", "auth.completeSetup", "auth.login", "auth.verifySecondFactor", "auth.logout",
  "public.unlockForm", "team.registerWithInvitationAction",
]);
/**
 * Nur „angemeldet“ nötig: eigenes Konto und eigene Mitgliedschaften. Löschen und
 * Übertragen eines Workspace prüfen die Inhaberrolle in der Dienstschicht
 * (tests/integration/team.test.ts).
 */
const SELF = new Set<string>([
  "auth.verifySecondFactor", "auth.startTotpSetup", "auth.confirmTotpSetup", "auth.disableTotp", "auth.changePassword",
  "settings.updateProfileAction", "settings.revokeSessionAction", "settings.revokeOtherSessionsAction",
  "settings.createWorkspaceAction", "settings.switchWorkspaceAction", "settings.deleteWorkspaceAction", "settings.listWorkspacesAction",
  "team.transferOwnershipAction", "team.leaveWorkspaceAction", "team.acceptInvitationAction",
]);

function actions() {
  const out: { name: string; body: string }[] = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".ts"))) {
    const src = readFileSync(path.join(DIR, f), "utf8");
    if (!src.startsWith('"use server"')) continue;
    const re = /export async function (\w+)\s*\(/g;
    const starts = [...src.matchAll(re)];
    starts.forEach((m, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      out.push({ name: `${f.replace(/\.ts$/, "")}.${m[1]}`, body: src.slice(m.index!, end) });
    });
  }
  return out;
}

describe("Server Actions", () => {
  const all = actions();
  it("findet Actions", () => expect(all.length).toBeGreaterThan(30));
  for (const a of all) {
    it(`${a.name} prüft Berechtigung`, () => {
      if (PUBLIC.has(a.name)) return;
      const withPerm = /assertViewer\(\s*"[a-z]+\.[a-z]+"\s*\)/.test(a.body);
      const anyAuth = /assertViewer\(\s*\)|getViewer\(\)|requireOwner|assertOwner|canAssign/.test(a.body);
      if (SELF.has(a.name)) return expect(anyAuth || withPerm, `${a.name}: keine Anmeldeprüfung`).toBe(true);
      // Alles, was Workspace-Daten berührt, braucht eine benannte Berechtigung
      expect(withPerm, `${a.name}: keine benannte Berechtigung (assertViewer("…"))`).toBe(true);
    });
  }
});
