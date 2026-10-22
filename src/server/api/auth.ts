/**
 * Authentifizierung der REST-API über Bearer-Tokens.
 * Wirksame Rechte = Scope des Tokens ∩ aktuelle Rolle des Besitzers im Workspace.
 * Wer den Workspace verlässt, dessen Tokens funktionieren nicht mehr.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { can, type Permission } from "../auth/rbac";
import { db, schema } from "../db";
import type { Role } from "../db/schema";
import { sha256 } from "../lib/crypto";
import { rateLimit } from "../lib/ratelimit";
import { TOKEN_PREFIX } from "./tokens";

export interface ApiPrincipal {
  tokenId: string;
  workspaceId: string;
  userId: string;
  role: Role;
  scope: "read" | "write";
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers?: Record<string, string>) {
    super(message);
  }
}

export function apiError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...headers } });
}

export async function authenticate(req: Request): Promise<ApiPrincipal> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (!m || !m[1].startsWith(TOKEN_PREFIX) || m[1].length > 100) throw new ApiError(401, "unauthorized", "API-Schlüssel fehlt oder ist ungültig. Erwartet: Authorization: Bearer plc_…", { "www-authenticate": 'Bearer realm="plica"' });
  const token = await db.query.apiTokens.findFirst({ where: eq(schema.apiTokens.tokenHash, sha256(m[1])) });
  if (!token || token.revokedAt || (token.expiresAt && token.expiresAt < new Date())) throw new ApiError(401, "unauthorized", "API-Schlüssel ist ungültig, abgelaufen oder widerrufen.", { "www-authenticate": 'Bearer realm="plica"' });
  const [member] = await db
    .select({ role: schema.memberships.role, disabled: schema.users.disabledAt })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(eq(schema.memberships.workspaceId, token.workspaceId), eq(schema.memberships.userId, token.userId)));
  if (!member || member.disabled) throw new ApiError(401, "unauthorized", "Der Besitzer dieses Schlüssels hat keinen Zugriff mehr auf den Workspace.");
  const rl = rateLimit(`api:${token.id}`, 600, 60_000);
  if (!rl.ok) throw new ApiError(429, "rate_limited", "Zu viele Anfragen. Bitte etwas warten.", { "retry-after": String(rl.retryAfter) });
  // lastUsedAt höchstens minütlich schreiben
  if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) await db.update(schema.apiTokens).set({ lastUsedAt: new Date() }).where(eq(schema.apiTokens.id, token.id));
  return { tokenId: token.id, workspaceId: token.workspaceId, userId: token.userId, role: member.role, scope: token.scope };
}

export function require(p: ApiPrincipal, perm: Permission, write = false) {
  if (write && p.scope !== "write") throw new ApiError(403, "insufficient_scope", "Dieser API-Schlüssel darf nur lesen.");
  if (!can(p.role, perm)) throw new ApiError(403, "forbidden", "Die Rolle des Schlüssel-Besitzers erlaubt diese Aktion nicht.");
}

/** Einheitlicher Wrapper: Authentifizierung, Fehlerformat, keine Interna nach außen. */
export function apiHandler<C>(fn: (req: Request, p: ApiPrincipal, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const p = await authenticate(req);
      return await fn(req, p, ctx);
    } catch (e) {
      if (e instanceof ApiError) return apiError(e.status, e.code, e.message, e.headers);
      if (e instanceof ZodError)
        return apiError(
          400,
          "invalid_request",
          e.issues
            .map((i) => (i.code === "unrecognized_keys" ? `Unbekannte Felder: ${i.keys.join(", ")}` : `${i.path.join(".") || "Anfrage"}: ${i.message}`))
            .join("; "),
        );
      console.error("[api]", e);
      return apiError(500, "internal", "Interner Fehler. Details stehen im Server-Log.");
    }
  };
}

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
