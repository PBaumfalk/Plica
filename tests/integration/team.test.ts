/**
 * Negative Berechtigungstests für Team, Einladungen und Workspaces.
 * Läuft gegen die echte Testdatenbank – keine Mocks der Autorisierung.
 */
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "@/server/db";
import { randomToken, sha256 } from "@/server/lib/crypto";
import { ServiceError, type Actor } from "@/server/workspaces/errors";
import * as team from "@/server/workspaces/team";
import * as ws from "@/server/workspaces/workspace";
import { makeWorkspace } from "./helpers";

type Role = Actor["role"];

async function addMember(workspaceId: string, role: Role, name = role) {
  const [u] = await db.insert(schema.users).values({ email: `${randomToken(6).toLowerCase()}@test.plica`, name, passwordHash: "x" }).returning();
  await db.insert(schema.memberships).values({ workspaceId, userId: u.id, role });
  return u;
}
const actor = (workspaceId: string, userId: string, role: Role): Actor => ({ workspaceId, userId, role });
const rejects = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(ServiceError);

describe("Team: Rollen und Mitglieder", () => {
  it("Bearbeiter kann niemanden einladen", async () => {
    const { workspace } = await makeWorkspace("A");
    const ed = await addMember(workspace.id, "editor");
    await rejects(team.createInvitation(actor(workspace.id, ed.id, "editor"), "neu@test.plica", "viewer"));
  });

  it("Administrator kann niemanden zum Inhaber machen und keine Admins verwalten", async () => {
    const { workspace } = await makeWorkspace("B");
    const admin = await addMember(workspace.id, "admin");
    const admin2 = await addMember(workspace.id, "admin");
    const viewer = await addMember(workspace.id, "viewer");
    const a = actor(workspace.id, admin.id, "admin");
    await rejects(team.changeRole(a, viewer.id, "owner"));
    await rejects(team.changeRole(a, viewer.id, "admin"));
    await rejects(team.createInvitation(a, "x@test.plica", "owner"));
    await rejects(team.createInvitation(a, "x@test.plica", "admin"));
    await rejects(team.changeRole(a, admin2.id, "viewer"));
    await rejects(team.removeMember(a, admin2.id));
    await team.changeRole(a, viewer.id, "editor");
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.workspaceId, workspace.id), eq(schema.memberships.userId, viewer.id)) });
    expect(m?.role).toBe("editor");
  });

  it("Der letzte Inhaber ist geschützt", async () => {
    const { workspace, user: owner } = await makeWorkspace("C");
    await rejects(team.leaveWorkspace(actor(workspace.id, owner.id, "owner")));
    const owner2 = await addMember(workspace.id, "owner");
    // zwei Inhaber: einer darf herabgestuft werden, danach nicht mehr der letzte
    await team.changeRole(actor(workspace.id, owner.id, "owner"), owner2.id, "admin");
    await rejects(team.changeRole(actor(workspace.id, owner2.id, "admin"), owner.id, "viewer"));
  });

  it("Entfernte Mitglieder verlieren sofort den Zugriff", async () => {
    const { workspace, user: owner } = await makeWorkspace("D");
    const ed = await addMember(workspace.id, "editor");
    const sid = sha256(randomToken());
    await db.insert(schema.sessions).values({ id: sid, userId: ed.id, workspaceId: workspace.id, expiresAt: new Date(Date.now() + 3600_000) });
    await team.removeMember(actor(workspace.id, owner.id, "owner"), ed.id);
    expect(await db.query.memberships.findFirst({ where: and(eq(schema.memberships.workspaceId, workspace.id), eq(schema.memberships.userId, ed.id)) })).toBeUndefined();
    const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sid) });
    expect(s?.workspaceId).toBeNull();
  });

  it("Rollen eines anderen Workspace lassen sich nicht ändern", async () => {
    const a = await makeWorkspace("E1");
    const b = await makeWorkspace("E2");
    const victim = await addMember(b.workspace.id, "viewer");
    await rejects(team.changeRole(actor(a.workspace.id, a.user.id, "owner"), victim.id, "admin"));
    await rejects(team.removeMember(actor(a.workspace.id, a.user.id, "owner"), b.user.id));
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.workspaceId, b.workspace.id), eq(schema.memberships.userId, victim.id)) });
    expect(m?.role).toBe("viewer");
  });
});

describe("Einladungen", () => {
  it("gelten nur für die eingeladene Adresse und nur einmal", async () => {
    const { workspace, user } = await makeWorkspace("F");
    const inv = await team.createInvitation(actor(workspace.id, user.id, "owner"), "Gast@Test.Plica", "reviewer");
    const other = await addMember((await makeWorkspace("F2")).workspace.id, "viewer");
    await rejects(team.acceptAsExistingUser(inv.token, { id: other.id, email: other.email }));
    const created = await team.acceptAsNewUser(inv.token, "Gast", "ein-langes-passwort-2026");
    expect(created.workspaceId).toBe(workspace.id);
    const m = await db.query.memberships.findFirst({ where: and(eq(schema.memberships.workspaceId, workspace.id), eq(schema.memberships.userId, created.userId)) });
    expect(m?.role).toBe("reviewer");
    await rejects(team.acceptAsNewUser(inv.token, "Nochmal", "ein-langes-passwort-2026"));
  });

  it("abgelaufene oder fremde Einladungen sind wertlos", async () => {
    const a = await makeWorkspace("G1");
    const b = await makeWorkspace("G2");
    const inv = await team.createInvitation(actor(a.workspace.id, a.user.id, "owner"), "spaet@test.plica", "viewer");
    await db.update(schema.invitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.invitations.id, inv.id));
    await rejects(team.acceptAsNewUser(inv.token, "Spät", "ein-langes-passwort-2026"));
    const inv2 = await team.createInvitation(actor(a.workspace.id, a.user.id, "owner"), "x2@test.plica", "viewer");
    await rejects(team.revokeInvitation(actor(b.workspace.id, b.user.id, "owner"), inv2.id));
    expect(await team.findInvitation("falsch")).toBeNull();
  });
});

describe("Workspaces", () => {
  it("Wechsel nur in eigene Workspaces", async () => {
    const a = await makeWorkspace("H1");
    const b = await makeWorkspace("H2");
    const sid = sha256(randomToken());
    await db.insert(schema.sessions).values({ id: sid, userId: a.user.id, workspaceId: a.workspace.id, expiresAt: new Date(Date.now() + 3600_000) });
    await rejects(ws.switchWorkspace(sid, a.user.id, b.workspace.id));
    // Nur der Inhaber der Installation legt Workspaces an
    await rejects(ws.createWorkspace(a.user.id, "H3"));
    await db.update(schema.users).set({ isInstanceAdmin: true }).where(eq(schema.users.id, a.user.id));
    const created = await ws.createWorkspace(a.user.id, "H3");
    await ws.switchWorkspace(sid, a.user.id, created.id);
    expect((await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sid) }))?.workspaceId).toBe(created.id);
  });

  it("Löschen nur durch Inhaber, mit Namen und nicht den einzigen Workspace", async () => {
    const { workspace, user } = await makeWorkspace("Löschbar");
    const admin = await addMember(workspace.id, "admin");
    await rejects(ws.deleteWorkspace(actor(workspace.id, admin.id, "admin"), "Löschbar"));
    await rejects(ws.deleteWorkspace(actor(workspace.id, user.id, "owner"), "Löschbar"));
    await db.update(schema.users).set({ isInstanceAdmin: true }).where(eq(schema.users.id, user.id));
    await ws.createWorkspace(user.id, "Ersatz");
    await rejects(ws.deleteWorkspace(actor(workspace.id, user.id, "owner"), "falsch"));
    await ws.deleteWorkspace(actor(workspace.id, user.id, "owner"), "Löschbar");
    expect(await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, workspace.id) })).toBeUndefined();
  });

  it("Export enthält nur Daten des eigenen Workspace", async () => {
    const a = await makeWorkspace("I1");
    const b = await makeWorkspace("I2");
    await db.insert(schema.auditLog).values({ workspaceId: b.workspace.id, action: "form.created" });
    const viewer = await addMember(a.workspace.id, "viewer");
    await rejects(ws.exportWorkspace(actor(a.workspace.id, viewer.id, "viewer")));
    const data = await ws.exportWorkspace(actor(a.workspace.id, a.user.id, "owner"));
    expect(data.workspace.id).toBe(a.workspace.id);
    expect(data.members.map((m) => m.email)).not.toContain(b.user.email);
    const log = await ws.listAudit(a.workspace.id, {});
    expect(log.rows.filter((r) => r.action === "form.created")).toHaveLength(0);
    expect(log.rows.some((r) => r.action === "workspace.exported")).toBe(true);
  });
});
