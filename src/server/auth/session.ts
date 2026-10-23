/**
 * Sitzungen: zufälliges Token im HttpOnly-Cookie, in der DB nur sha256.
 * Gleitende Laufzeit 14 Tage, höchstens ein Schreibzugriff pro Stunde.
 */
import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { config } from "../config";
import { db, schema } from "../db";
import { decrypt, encrypt, randomToken, sha256 } from "../lib/crypto";
import { deviceLabel } from "../lib/request";
import { can, type Permission } from "./rbac";
import type { Role } from "../db/schema";

const TTL_MS = 14 * 24 * 3600_000;

export function cookieName() {
  return config().secureCookies ? "__Host-plica_session" : "plica_session";
}

export async function createSession(userId: string, opts: { mfaPending?: boolean; workspaceId?: string | null; viaOidc?: boolean; oidcIdToken?: string } = {}) {
  const token = randomToken();
  const h = await headers();
  let workspaceId = opts.workspaceId ?? null;
  if (!workspaceId) {
    const m = await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, userId), orderBy: (m, { asc }) => asc(m.createdAt) });
    workspaceId = m?.workspaceId ?? null;
  }
  await db.insert(schema.sessions).values({
    id: sha256(token),
    userId,
    workspaceId,
    mfaPending: !!opts.mfaPending,
    viaOidc: !!opts.viaOidc,
    oidcIdToken: opts.oidcIdToken ? encrypt(opts.oidcIdToken, "oidc-id-token") : null,
    device: deviceLabel(h.get("user-agent")),
    expiresAt: new Date(Date.now() + (opts.mfaPending ? 10 * 60_000 : TTL_MS)),
  });
  (await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: config().secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: opts.mfaPending ? 600 : TTL_MS / 1000,
  });
}

/** Beendet die aktuelle Sitzung; gibt zurück, ob sie über OIDC entstanden war (samt ID-Token für das Abmelden beim Anbieter). */
export async function destroySession(): Promise<{ viaOidc: boolean; idToken: string | null }> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  let out: { viaOidc: boolean; idToken: string | null } = { viaOidc: false, idToken: null };
  if (token && token.length <= 100) {
    const [row] = await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).returning({ viaOidc: schema.sessions.viaOidc, idToken: schema.sessions.oidcIdToken });
    if (row) {
      let idToken: string | null = null;
      try {
        idToken = row.idToken ? decrypt(row.idToken, "oidc-id-token") : null;
      } catch {
        idToken = null;
      }
      out = { viaOidc: row.viaOidc, idToken };
    }
  }
  jar.delete(cookieName());
  return out;
}

export interface Viewer {
  user: { id: string; email: string; name: string; isInstanceAdmin: boolean; totpEnabled: boolean };
  sessionId: string;
  mfaPending: boolean;
  workspace: { id: string; name: string } | null;
  role: Role | null;
}

/** Aktuelle Sitzung (pro Request zwischengespeichert). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const row = await db.query.sessions.findFirst({ where: and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())) });
  if (!row) return null;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
  if (!user || user.disabledAt) return null;

  let workspace: Viewer["workspace"] = null;
  let role: Role | null = null;
  if (!row.mfaPending) {
    const base = db
      .select({ id: schema.workspaces.id, name: schema.workspaces.name, role: schema.memberships.role })
      .from(schema.memberships)
      .innerJoin(schema.workspaces, eq(schema.workspaces.id, schema.memberships.workspaceId));
    let m = row.workspaceId ? await base.where(and(eq(schema.memberships.userId, user.id), eq(schema.memberships.workspaceId, row.workspaceId))).limit(1) : [];
    if (!m[0]) {
      // Workspace entzogen oder gelöscht: auf eine verbleibende Mitgliedschaft ausweichen
      m = await base.where(eq(schema.memberships.userId, user.id)).orderBy(schema.memberships.createdAt).limit(1);
      if (m[0]) await db.update(schema.sessions).set({ workspaceId: m[0].id }).where(eq(schema.sessions.id, id));
    }
    if (m[0]) {
      workspace = { id: m[0].id, name: m[0].name };
      role = m[0].role;
    }
  }

  if (!row.mfaPending && Date.now() - row.lastSeenAt.getTime() > 3600_000) {
    await db.update(schema.sessions).set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + TTL_MS) }).where(eq(schema.sessions.id, id));
  }
  return {
    user: { id: user.id, email: user.email, name: user.name, isInstanceAdmin: user.isInstanceAdmin, totpEnabled: user.totpEnabled },
    sessionId: id,
    mfaPending: row.mfaPending,
    workspace,
    role,
  };
});

export type AuthedViewer = Viewer & { workspace: { id: string; name: string }; role: Role };

/** Für Seiten: leitet zur Anmeldung um, wenn nötig. */
export async function requireViewer(perm?: Permission): Promise<AuthedViewer> {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.mfaPending) redirect("/login/zwei-faktor");
  // Ohne Workspace: Hinweis mit Möglichkeit, einen anzulegen
  if (!v.workspace || !v.role) redirect("/einladung");
  if (perm && !can(v.role, perm)) redirect("/?fehler=berechtigung");
  return v as AuthedViewer;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Für Server Actions und Route-Handler: wirft statt umzuleiten. */
export async function assertViewer(perm?: Permission): Promise<AuthedViewer> {
  const v = await getViewer();
  if (!v || v.mfaPending) throw new AuthError(401, "Bitte melde dich erneut an.");
  if (!v.workspace || !v.role) throw new AuthError(403, "Kein Workspace ausgewählt.");
  if (perm && !can(v.role, perm)) throw new AuthError(403, "Dafür fehlt dir die Berechtigung.");
  return v as AuthedViewer;
}
