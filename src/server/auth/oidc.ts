/**
 * Anmeldung über OpenID Connect (z. B. authentik).
 *
 * Authorization Code mit PKCE, vertraulicher Client, Discovery über
 * .well-known. state, nonce und die ID-Token-Signatur (JWKS) prüft
 * openid-client. Konten werden über „<issuer>|<sub>“ zugeordnet; eine
 * Verknüpfung per E-Mail nur bei email_verified=true, sonst wäre eine
 * Kontoübernahme über eine fremde, unbestätigte Adresse möglich.
 *
 * Rollen im Standard-Workspace (dem ältesten) folgen bei jeder Anmeldung
 * den Gruppen. Der letzte Inhaber eines Workspace wird nie herabgestuft.
 */
import "server-only";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import * as client from "openid-client";
import { audit } from "../audit";
import { config, type OidcConfig } from "../config";
import { db, schema } from "../db";
import type { Role } from "../db/schema";
import { decrypt, encrypt } from "../lib/crypto";
import { needsSetup } from "../setup";

export const OIDC_CALLBACK_PATH = "/api/auth/oidc/callback";
const STATE_TTL_MS = 10 * 60_000;

export type OidcErrorCode =
  | "sso_disabled"
  | "sso_unavailable"
  | "sso_denied"
  | "sso_failed"
  | "sso_expired"
  | "sso_group"
  | "sso_email_unverified"
  | "sso_conflict"
  | "sso_no_account"
  | "sso_disabled_user"
  | "sso_setup_pending";

export class OidcError extends Error {
  constructor(public code: OidcErrorCode, public detail?: unknown) {
    super(code);
  }
}

let discovered: Promise<client.Configuration> | null = null;

/** Nur für Tests: zwischengespeicherte Discovery verwerfen. */
export function resetOidcDiscovery() {
  discovered = null;
}

function loopback(url: URL) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export function oidcClient(c: OidcConfig = requireOidc()): Promise<client.Configuration> {
  const url = new URL(c.issuer);
  // Unverschlüsseltes HTTP nur für lokale Tests; in Produktion verlangt config() https.
  const insecure = url.protocol === "http:" && (config().PLICA_ENV !== "production" || loopback(url));
  discovered ??= client
    .discovery(url, c.clientId, c.clientSecret, undefined, insecure ? { execute: [client.allowInsecureRequests] } : undefined)
    .catch((e) => {
      discovered = null;
      throw e;
    })
    .then((cfg) => {
      // ID-Token-Signatur immer über JWKS prüfen (openid-client verzichtet sonst beim Token-Endpunkt darauf)
      client.enableNonRepudiationChecks(cfg);
      return cfg;
    });
  return discovered;
}

function requireOidc(): OidcConfig {
  const c = config().oidc;
  if (!c) throw new OidcError("sso_disabled");
  return c;
}

export const redirectUri = () => `${config().APP_URL}${OIDC_CALLBACK_PATH}`;

/** Nur Pfade dieser Instanz: kein Schema, kein //host, keine Steuerzeichen oder Punktsegmente. */
export function safeNextPath(v: unknown): string {
  if (typeof v !== "string" || v.length > 500 || !v.startsWith("/") || v.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(v)) return "/";
  if (/(^|\/)(\.|%2e){1,2}(\/|$)/i.test(v)) return "/";
  try {
    const base = new URL("http://plica.invalid");
    const u = new URL(v, base);
    const out = u.pathname + u.search + u.hash;
    return u.origin === base.origin && !out.startsWith("//") ? out : "/";
  } catch {
    return "/";
  }
}

interface LoginState {
  verifier: string;
  state: string;
  nonce: string;
  next: string;
  exp: number;
}

/** Startet die Anmeldung: Ziel-URL beim Anbieter und verschlüsselter Zustand für das Cookie. */
export async function beginOidcLogin(next: unknown): Promise<{ url: string; stateCookie: string }> {
  const c = requireOidc();
  let cfg: client.Configuration;
  try {
    cfg = await oidcClient(c);
  } catch (e) {
    throw new OidcError("sso_unavailable", e);
  }
  const verifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const url = client.buildAuthorizationUrl(cfg, {
    redirect_uri: redirectUri(),
    scope: c.scopes,
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });
  const st: LoginState = { verifier, state, nonce, next: safeNextPath(next), exp: Date.now() + STATE_TTL_MS };
  return { url: url.href, stateCookie: encrypt(JSON.stringify(st), "oidc-state") };
}

export interface OidcClaims {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  groups: string[];
}

/** Rückkehr vom Anbieter: Zustand prüfen, Code eintauschen, Claims einsammeln. */
export async function finishOidcLogin(currentUrl: URL, stateCookie: string | undefined): Promise<{ claims: OidcClaims; next: string; idToken: string | null }> {
  const c = requireOidc();
  const idpError = currentUrl.searchParams.get("error");
  if (idpError) throw new OidcError(idpError === "access_denied" ? "sso_denied" : "sso_failed", { idpError, description: currentUrl.searchParams.get("error_description") });

  let st: LoginState;
  try {
    if (!stateCookie || stateCookie.length > 4000) throw new Error("Zustands-Cookie fehlt");
    st = JSON.parse(decrypt(stateCookie, "oidc-state")) as LoginState;
    if (!(st.exp > Date.now())) throw new Error("Zustand abgelaufen");
  } catch (e) {
    throw new OidcError("sso_expired", e);
  }

  let cfg: client.Configuration;
  try {
    cfg = await oidcClient(c);
  } catch (e) {
    throw new OidcError("sso_unavailable", e);
  }

  // Anderer Tab oder alter Link: passt nicht zum Zustand dieses Browsers
  if (currentUrl.searchParams.get("state") !== st.state) throw new OidcError("sso_expired", "state passt nicht");

  // Die Antwort muss an der registrierten Redirect-URI ankommen – nicht an dem, was der Proxy meldet.
  const callback = new URL(redirectUri());
  callback.search = currentUrl.search;

  let raw: Record<string, unknown>;
  let idToken: string | null = null;
  try {
    const tokens = await client.authorizationCodeGrant(cfg, callback, { pkceCodeVerifier: st.verifier, expectedState: st.state, expectedNonce: st.nonce, idTokenExpected: true });
    raw = { ...(tokens.claims() ?? {}) };
    idToken = tokens.id_token ?? null;
    if (!raw.sub) throw new Error("ID-Token ohne sub");
    // Fehlen E-Mail oder Gruppen im ID-Token, liefert UserInfo sie nach (Subjekt wird dabei geprüft).
    if ((!raw.email || !Array.isArray(raw.groups)) && cfg.serverMetadata().userinfo_endpoint) {
      const info = await client.fetchUserInfo(cfg, tokens.access_token, String(raw.sub));
      raw = {
        ...raw,
        email: raw.email ?? info.email,
        email_verified: raw.email_verified ?? info.email_verified,
        name: raw.name ?? info.name,
        preferred_username: raw.preferred_username ?? info.preferred_username,
        groups: Array.isArray(raw.groups) ? raw.groups : info.groups,
      };
    }
  } catch (e) {
    throw new OidcError("sso_failed", e);
  }

  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase().slice(0, 254) : "";
  const name = [raw.name, raw.preferred_username].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  return {
    claims: {
      sub: String(raw.sub),
      email: email || null,
      emailVerified: raw.email_verified === true,
      name: name?.trim().slice(0, 120) ?? null,
      groups: Array.isArray(raw.groups) ? raw.groups.map(String) : [],
    },
    next: safeNextPath(st.next),
    idToken,
  };
}

/** Rolle laut Gruppen; null = Gruppen bestimmen keine Rolle. */
export function roleFromGroups(groups: string[], c: Pick<OidcConfig, "adminGroups" | "defaultRole">): Exclude<Role, "owner"> | null {
  if (c.adminGroups.some((g) => groups.includes(g))) return "admin";
  return c.defaultRole;
}

export function groupAllowed(groups: string[], c: Pick<OidcConfig, "allowedGroups" | "adminGroups">): boolean {
  if (!c.allowedGroups.length) return true;
  return [...c.allowedGroups, ...c.adminGroups].some((g) => groups.includes(g));
}

type UserRow = typeof schema.users.$inferSelect;

/**
 * Ordnet die Claims einem Konto zu (oder legt es an) und zieht die Rolle
 * im Standard-Workspace nach. Wirft OidcError, wenn keine Anmeldung möglich ist.
 */
export async function resolveOidcUser(claims: OidcClaims, c: OidcConfig = requireOidc()): Promise<UserRow> {
  // Vor der Ersteinrichtung nie: Das erste Konto entsteht nur mit dem Einrichtungscode
  if (await needsSetup()) throw new OidcError("sso_setup_pending");
  if (!groupAllowed(claims.groups, c)) throw new OidcError("sso_group", { sub: claims.sub });
  const subject = `${c.issuer}|${claims.sub}`;

  let user = await db.query.users.findFirst({ where: eq(schema.users.oidcSubject, subject) });
  if (!user && claims.email) {
    const byMail = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${claims.email}` });
    if (byMail) {
      if (byMail.disabledAt) throw new OidcError("sso_disabled_user");
      if (!claims.emailVerified) throw new OidcError("sso_email_unverified", { sub: claims.sub });
      if (byMail.oidcSubject) throw new OidcError("sso_conflict", { sub: claims.sub, reason: "Konto bereits mit anderem SSO-Subjekt verknüpft" });
      const [linked] = await db
        .update(schema.users)
        .set({ oidcSubject: subject })
        .where(and(eq(schema.users.id, byMail.id), sql`${schema.users.oidcSubject} is null`))
        .returning();
      if (!linked) throw new OidcError("sso_conflict", { sub: claims.sub });
      await audit({ userId: linked.id, action: "login.sso_linked", meta: { issuer: c.issuer } });
      user = linked;
    }
  }
  if (!user && c.autoCreate) {
    if (!claims.email) throw new OidcError("sso_no_account", { sub: claims.sub, reason: "keine E-Mail im Token" });
    if (!claims.emailVerified) throw new OidcError("sso_email_unverified", { sub: claims.sub });
    const [created] = await db
      .insert(schema.users)
      // Kein Passwort: leerer Hash besteht keine Prüfung. Anmeldung nur per SSO.
      .values({ email: claims.email, name: claims.name ?? claims.email, passwordHash: "", oidcSubject: subject })
      .onConflictDoNothing()
      .returning();
    if (!created) throw new OidcError("sso_conflict", { sub: claims.sub, reason: "E-Mail oder Subjekt bereits vergeben" });
    await audit({ userId: created.id, action: "login.sso_user_created", meta: { issuer: c.issuer } });
    user = created;
  }
  if (!user) throw new OidcError("sso_no_account", { sub: claims.sub });
  if (user.disabledAt) throw new OidcError("sso_disabled_user");

  await syncDefaultWorkspaceRole(user.id, claims.groups, c);
  return user;
}

/** Rolle im Standard-Workspace an die Gruppen angleichen. Gibt den Workspace zurück, falls einer betroffen war. */
export async function syncDefaultWorkspaceRole(userId: string, groups: string[], c: Pick<OidcConfig, "adminGroups" | "defaultRole">): Promise<string | null> {
  const target = roleFromGroups(groups, c);
  if (!target) return null;
  const ws = await db.query.workspaces.findFirst({ orderBy: asc(schema.workspaces.createdAt) });
  if (!ws) return null;

  const change = await db.transaction(async (tx) => {
    // Inhaber des Workspace sperren, damit parallele Anmeldungen nicht beide den „vorletzten“ Inhaber herabstufen
    const owners = await tx
      .select({ userId: schema.memberships.userId })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.workspaceId, ws.id), eq(schema.memberships.role, "owner")))
      .for("update");
    const [m] = await tx
      .select({ role: schema.memberships.role })
      .from(schema.memberships)
      .where(and(eq(schema.memberships.workspaceId, ws.id), eq(schema.memberships.userId, userId)));
    if (!m) {
      await tx.insert(schema.memberships).values({ workspaceId: ws.id, userId, role: target }).onConflictDoNothing();
      return { from: null, to: target };
    }
    if (m.role === target) return null;
    if (m.role === "owner") {
      // Inhaber in einer Admin-Gruppe bleiben Inhaber; sonst nur, wenn ein weiterer Inhaber bleibt
      if (target === "admin" || owners.filter((o) => o.userId !== userId).length === 0) return null;
    }
    await tx
      .update(schema.memberships)
      .set({ role: target })
      .where(and(eq(schema.memberships.workspaceId, ws.id), eq(schema.memberships.userId, userId), ne(schema.memberships.role, target)));
    return { from: m.role, to: target };
  });
  if (change) {
    const meta = change.from ? { from: change.from, to: change.to, via: "sso" } : { role: change.to, via: "sso" };
    await audit({ workspaceId: ws.id, userId, action: change.from ? "member.role_synced" : "member.joined", targetType: "user", targetId: userId, meta });
  }
  return ws.id;
}

/**
 * URL zum Abmelden beim Anbieter, falls aktiviert und angeboten. Den Rücksprung nach
 * PLICA erlauben Anbieter wie authentik nur zusammen mit id_token_hint.
 */
export async function endSessionUrl(idTokenHint: string | null): Promise<string | null> {
  const c = config().oidc;
  if (!c?.logout) return null;
  try {
    const cfg = await oidcClient(c);
    if (!cfg.serverMetadata().end_session_endpoint) return null;
    const params: Record<string, string> = idTokenHint ? { id_token_hint: idTokenHint, post_logout_redirect_uri: `${config().APP_URL}/login` } : {};
    return client.buildEndSessionUrl(cfg, params).href;
  } catch {
    return null;
  }
}

export const OIDC_ERROR_TEXT: Record<OidcErrorCode, string> = {
  sso_disabled: "Die Anmeldung über SSO ist nicht eingerichtet.",
  sso_unavailable: "Der Anmeldedienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.",
  sso_denied: "Die Anmeldung wurde abgebrochen.",
  sso_failed: "Die Anmeldung über SSO ist fehlgeschlagen. Bitte versuche es erneut.",
  sso_expired: "Die Anmeldung hat zu lange gedauert. Bitte starte sie neu.",
  sso_group: "Dein Konto ist für PLICA nicht freigeschaltet. Bitte wende dich an die Verwaltung.",
  sso_email_unverified: "Deine E-Mail-Adresse ist beim Anmeldedienst nicht bestätigt. Bitte wende dich an die Verwaltung.",
  sso_conflict: "Für diese E-Mail-Adresse besteht bereits eine andere SSO-Verknüpfung. Bitte wende dich an die Verwaltung.",
  sso_no_account: "Für dieses Konto gibt es keinen Zugang zu PLICA. Bitte lass dich einladen.",
  sso_disabled_user: "Dieses Konto ist gesperrt.",
  sso_setup_pending: "PLICA ist noch nicht eingerichtet. Bitte zuerst mit dem Einrichtungscode das Inhaberkonto anlegen.",
};
