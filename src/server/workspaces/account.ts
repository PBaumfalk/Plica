/** Eigenes Konto: Profil und Sitzungen. */
import "server-only";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { audit } from "../audit";
import { verifyPassword } from "../auth/password";
import { db, schema } from "../db";
import { ServiceError } from "./errors";

export async function updateProfile(userId: string, input: { name: string; email: string; password?: string }) {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) throw new ServiceError("Konto nicht gefunden.");
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().toLowerCase();
  if (!name) throw new ServiceError("Bitte deinen Namen angeben.", "name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new ServiceError("Bitte eine gültige E-Mail-Adresse angeben.", "email");
  const emailChanged = email !== user.email.toLowerCase();
  if (emailChanged) {
    // Neue Anmeldeadresse nur mit Passwort
    if (!input.password || !(await verifyPassword(user.passwordHash, input.password))) throw new ServiceError("Zum Ändern der E-Mail-Adresse bitte das aktuelle Passwort eingeben.", "password");
    const taken = await db.query.users.findFirst({ where: and(sql`lower(${schema.users.email}) = ${email}`, ne(schema.users.id, userId)), columns: { id: true } });
    if (taken) throw new ServiceError("Diese E-Mail-Adresse wird bereits verwendet.", "email");
  }
  await db.update(schema.users).set({ name, email }).where(eq(schema.users.id, userId));
  await audit({ userId, action: emailChanged ? "user.email_changed" : "user.profile_updated" });
}

export async function listSessions(userId: string) {
  return db
    .select({ id: schema.sessions.id, device: schema.sessions.device, createdAt: schema.sessions.createdAt, lastSeenAt: schema.sessions.lastSeenAt })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.mfaPending, false), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.lastSeenAt));
}

/** Sitzungs-IDs (sha256) nach außen nur gekürzt – Abgleich über Präfix des eigenen Kontos. */
export async function revokeSession(userId: string, currentSessionId: string, idPrefix: string) {
  if (!/^[0-9a-f]{12}$/.test(idPrefix)) throw new ServiceError("Sitzung nicht gefunden.");
  if (currentSessionId.startsWith(idPrefix)) throw new ServiceError("Die aktuelle Sitzung beendest du über „Abmelden“.");
  const res = await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), sql`${schema.sessions.id} like ${idPrefix + "%"}`)).returning({ id: schema.sessions.id });
  if (!res.length) throw new ServiceError("Sitzung nicht gefunden.");
  await audit({ userId, action: "session.revoked" });
}

export async function revokeOtherSessions(userId: string, currentSessionId: string) {
  const res = await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, currentSessionId))).returning({ id: schema.sessions.id });
  await audit({ userId, action: "session.revoked_all", meta: { count: res.length } });
  return res.length;
}
