/**
 * Team und Einladungen. Jede Funktion prüft Rolle und Workspace des
 * Akteurs selbst – zusätzlich zur Prüfung in der Server Action.
 */
import "server-only";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { audit } from "../audit";
import { can, canAssign, ROLE_RANK } from "../auth/rbac";
import { hashPassword, passwordProblem } from "../auth/password";
import { config } from "../config";
import { db, schema } from "../db";
import type { Role } from "../db/schema";
import { randomToken, sha256 } from "../lib/crypto";
import { ServiceError, type Actor } from "./errors";

const INVITE_DAYS = 7;

function need(actor: Actor, perm: Parameters<typeof can>[1]) {
  if (!can(actor.role, perm)) throw new ServiceError("Dafür fehlt dir die Berechtigung.");
}

export async function listMembers(workspaceId: string) {
  return db
    .select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.memberships.role, since: schema.memberships.createdAt, lastLoginAt: sql<Date | null>`greatest(${schema.users.lastLoginAt}, (select max(s.last_seen_at) from ${schema.sessions} s where s.user_id = ${schema.users.id}))`, totpEnabled: schema.users.totpEnabled })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(eq(schema.memberships.workspaceId, workspaceId))
    .orderBy(sql`case ${schema.memberships.role} when 'owner' then 0 when 'admin' then 1 when 'editor' then 2 when 'reviewer' then 3 else 4 end`, asc(schema.users.name));
}

async function membership(workspaceId: string, userId: string) {
  return db.query.memberships.findFirst({ where: and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.userId, userId)) });
}

async function ownerCount(workspaceId: string) {
  return db.$count(schema.memberships, and(eq(schema.memberships.workspaceId, workspaceId), eq(schema.memberships.role, "owner")));
}

/** Darf der Akteur dieses Mitglied überhaupt verwalten? */
function assertManageable(actor: Actor, target: { userId: string; role: Role }) {
  if (target.userId === actor.userId) throw new ServiceError("Deine eigene Rolle kannst du hier nicht ändern.");
  if (!canAssign(actor.role, target.role)) throw new ServiceError("Dieses Mitglied darfst du nicht verwalten.");
}

export async function changeRole(actor: Actor, targetUserId: string, role: Role) {
  need(actor, "members.manage");
  if (role === "owner") throw new ServiceError("Inhaber wird man nur durch Übertragung der Inhaberschaft.");
  const m = await membership(actor.workspaceId, targetUserId);
  if (!m) throw new ServiceError("Mitglied nicht gefunden.");
  assertManageable(actor, m);
  if (!canAssign(actor.role, role)) throw new ServiceError("Diese Rolle darfst du nicht vergeben.");
  if (m.role === "owner" && (await ownerCount(actor.workspaceId)) <= 1) throw new ServiceError("Der letzte Inhaber kann nicht herabgestuft werden.");
  await db.update(schema.memberships).set({ role }).where(and(eq(schema.memberships.workspaceId, actor.workspaceId), eq(schema.memberships.userId, targetUserId)));
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.role_changed", targetType: "user", targetId: targetUserId, meta: { from: m.role, to: role } });
}

export async function removeMember(actor: Actor, targetUserId: string) {
  need(actor, "members.manage");
  const m = await membership(actor.workspaceId, targetUserId);
  if (!m) throw new ServiceError("Mitglied nicht gefunden.");
  assertManageable(actor, m);
  if (m.role === "owner" && (await ownerCount(actor.workspaceId)) <= 1) throw new ServiceError("Der letzte Inhaber kann nicht entfernt werden.");
  await db.transaction(async (tx) => {
    await tx.delete(schema.memberships).where(and(eq(schema.memberships.workspaceId, actor.workspaceId), eq(schema.memberships.userId, targetUserId)));
    // Laufende Sitzungen verlieren den Workspace sofort
    await tx.update(schema.sessions).set({ workspaceId: null }).where(and(eq(schema.sessions.userId, targetUserId), eq(schema.sessions.workspaceId, actor.workspaceId)));
  });
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.removed", targetType: "user", targetId: targetUserId, meta: { role: m.role } });
}

/** Mitglied verlässt den Workspace selbst. */
export async function leaveWorkspace(actor: Actor) {
  if (actor.role === "owner" && (await ownerCount(actor.workspaceId)) <= 1) throw new ServiceError("Als einziger Inhaber kannst du den Workspace nicht verlassen. Übertrage vorher die Inhaberschaft.");
  await db.delete(schema.memberships).where(and(eq(schema.memberships.workspaceId, actor.workspaceId), eq(schema.memberships.userId, actor.userId)));
  await db.update(schema.sessions).set({ workspaceId: null }).where(and(eq(schema.sessions.userId, actor.userId), eq(schema.sessions.workspaceId, actor.workspaceId)));
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.left" });
}

export async function transferOwnership(actor: Actor, targetUserId: string) {
  if (actor.role !== "owner") throw new ServiceError("Nur Inhaber können die Inhaberschaft übertragen.");
  if (targetUserId === actor.userId) throw new ServiceError("Du bist bereits Inhaber.");
  const m = await membership(actor.workspaceId, targetUserId);
  if (!m) throw new ServiceError("Mitglied nicht gefunden.");
  await db.transaction(async (tx) => {
    await tx.update(schema.memberships).set({ role: "owner" }).where(and(eq(schema.memberships.workspaceId, actor.workspaceId), eq(schema.memberships.userId, targetUserId)));
    await tx.update(schema.memberships).set({ role: "admin" }).where(and(eq(schema.memberships.workspaceId, actor.workspaceId), eq(schema.memberships.userId, actor.userId)));
  });
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "workspace.ownership_transferred", targetType: "user", targetId: targetUserId });
}

/* ---------------- Einladungen ---------------- */

export function inviteLink(token: string) {
  return `${config().APP_URL}/einladung/${token}`;
}

export async function createInvitation(actor: Actor, emailRaw: string, role: Role) {
  need(actor, "members.manage");
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ServiceError("Bitte eine gültige E-Mail-Adresse angeben.", "email");
  if (role === "owner" || !canAssign(actor.role, role)) throw new ServiceError("Diese Rolle darfst du nicht vergeben.", "role");
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.workspaceId, actor.workspaceId), sql`lower(${schema.users.email}) = ${email}`))
    .limit(1);
  if (existing.length) throw new ServiceError("Diese Person ist bereits Mitglied.", "email");
  // Offene Einladung an dieselbe Adresse ersetzen
  await db.delete(schema.invitations).where(and(eq(schema.invitations.workspaceId, actor.workspaceId), sql`lower(${schema.invitations.email}) = ${email}`, isNull(schema.invitations.acceptedAt)));
  const token = randomToken(32);
  const [inv] = await db
    .insert(schema.invitations)
    .values({ workspaceId: actor.workspaceId, email, role, tokenHash: sha256(token), invitedBy: actor.userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) })
    .returning();
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.invited", targetType: "invitation", targetId: inv.id, meta: { role } });
  return { id: inv.id, token, link: inviteLink(token), email, role, expiresAt: inv.expiresAt };
}

export async function listInvitations(workspaceId: string) {
  return db
    .select({ id: schema.invitations.id, email: schema.invitations.email, role: schema.invitations.role, expiresAt: schema.invitations.expiresAt, createdAt: schema.invitations.createdAt, invitedBy: schema.users.name })
    .from(schema.invitations)
    .leftJoin(schema.users, eq(schema.users.id, schema.invitations.invitedBy))
    .where(and(eq(schema.invitations.workspaceId, workspaceId), isNull(schema.invitations.acceptedAt), gt(schema.invitations.expiresAt, new Date())))
    .orderBy(asc(schema.invitations.createdAt));
}

export async function revokeInvitation(actor: Actor, invitationId: string) {
  need(actor, "members.manage");
  if (!/^[0-9a-f-]{36}$/.test(invitationId)) throw new ServiceError("Einladung nicht gefunden.");
  const res = await db.delete(schema.invitations).where(and(eq(schema.invitations.id, invitationId), eq(schema.invitations.workspaceId, actor.workspaceId), isNull(schema.invitations.acceptedAt))).returning({ id: schema.invitations.id });
  if (!res.length) throw new ServiceError("Einladung nicht gefunden.");
  await audit({ workspaceId: actor.workspaceId, userId: actor.userId, action: "member.invitation_revoked", targetType: "invitation", targetId: invitationId });
}

/** Einladung zum Token – nur gültige, offene. */
export async function findInvitation(token: string) {
  if (!token || token.length > 100) return null;
  const rows = await db
    .select({ id: schema.invitations.id, workspaceId: schema.invitations.workspaceId, email: schema.invitations.email, role: schema.invitations.role, expiresAt: schema.invitations.expiresAt, acceptedAt: schema.invitations.acceptedAt, workspace: schema.workspaces.name, invitedBy: schema.users.name })
    .from(schema.invitations)
    .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.invitations.workspaceId))
    .leftJoin(schema.users, eq(schema.users.id, schema.invitations.invitedBy))
    .where(eq(schema.invitations.tokenHash, sha256(token)))
    .limit(1);
  const inv = rows[0];
  if (!inv) return null;
  return { ...inv, valid: !inv.acceptedAt && inv.expiresAt > new Date() };
}

async function joinWithInvitation(inv: NonNullable<Awaited<ReturnType<typeof findInvitation>>>, userId: string) {
  await db.transaction(async (tx) => {
    // Einmal verwendbar: nur der erste Aufruf setzt acceptedAt
    const claimed = await tx.update(schema.invitations).set({ acceptedAt: new Date() }).where(and(eq(schema.invitations.id, inv.id), isNull(schema.invitations.acceptedAt))).returning({ id: schema.invitations.id });
    if (!claimed.length) throw new ServiceError("Diese Einladung wurde bereits verwendet.");
    await tx.insert(schema.memberships).values({ workspaceId: inv.workspaceId, userId, role: inv.role }).onConflictDoNothing();
  });
  await audit({ workspaceId: inv.workspaceId, userId, action: "member.joined", targetType: "invitation", targetId: inv.id, meta: { role: inv.role } });
}

export async function acceptAsExistingUser(token: string, user: { id: string; email: string }) {
  const inv = await findInvitation(token);
  if (!inv || !inv.valid) throw new ServiceError("Diese Einladung ist abgelaufen oder wurde schon verwendet.");
  if (inv.email.toLowerCase() !== user.email.toLowerCase()) throw new ServiceError(`Diese Einladung gilt für ${inv.email}. Melde dich mit dieser Adresse an.`);
  await joinWithInvitation(inv, user.id);
  return inv.workspaceId;
}

export async function acceptAsNewUser(token: string, name: string, password: string) {
  const inv = await findInvitation(token);
  if (!inv || !inv.valid) throw new ServiceError("Diese Einladung ist abgelaufen oder wurde schon verwendet.");
  const cleanName = name.trim().slice(0, 120);
  if (!cleanName) throw new ServiceError("Bitte deinen Namen angeben.", "name");
  const problem = passwordProblem(password, inv.email);
  if (problem) throw new ServiceError(problem, "password");
  const exists = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${inv.email.toLowerCase()}`, columns: { id: true } });
  if (exists) throw new ServiceError("Für diese Adresse gibt es schon ein Konto. Bitte melde dich an und öffne den Link erneut.");
  const [user] = await db.insert(schema.users).values({ email: inv.email, name: cleanName, passwordHash: await hashPassword(password) }).returning();
  await audit({ workspaceId: inv.workspaceId, userId: user.id, action: "user.created", meta: { via: "invitation" } });
  await joinWithInvitation(inv, user.id);
  return { userId: user.id, workspaceId: inv.workspaceId };
}

export const roleRank = ROLE_RANK;
