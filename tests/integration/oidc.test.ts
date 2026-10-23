/**
 * OIDC-Anmeldung gegen einen nachgebauten Anbieter (Discovery, JWKS, Token,
 * UserInfo): PKCE, state, nonce, Signatur, Kontozuordnung und Rollen aus Gruppen.
 */
import { createHash, createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { createServer, type Server } from "node:http";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const IDP = vi.hoisted(() => {
  const port = 4781;
  const issuer = `http://127.0.0.1:${port}/application/o/plica/`;
  process.env.OIDC_ISSUER = issuer;
  process.env.OIDC_CLIENT_ID = "plica-client";
  process.env.OIDC_CLIENT_SECRET = "plica-secret-test-only";
  process.env.OIDC_ALLOWED_GROUPS = "plica";
  process.env.OIDC_ADMIN_GROUPS = "admin";
  process.env.OIDC_AUTO_CREATE_USERS = "true";
  process.env.OIDC_DEFAULT_ROLE = "editor";
  process.env.OIDC_LOGOUT = "true";
  return { port, issuer };
});

import { config, type OidcConfig } from "@/server/config";
import { db, schema } from "@/server/db";
import { beginOidcLogin, endSessionUrl, finishOidcLogin, OidcError, resetOidcDiscovery, resolveOidcUser, safeNextPath, syncDefaultWorkspaceRole, type OidcClaims } from "@/server/auth/oidc";
import { encrypt, randomToken } from "@/server/lib/crypto";
import { makeWorkspace } from "./helpers";

/* ---------- nachgebauter Anbieter ---------- */

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const foreignKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const kid = "test-key";

function jwt(payload: Record<string, unknown>, key: KeyObject = privateKey) {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const body = b64u(JSON.stringify(payload));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key);
  return `${head}.${body}.${b64u(sig)}`;
}

interface Grant {
  challenge: string;
  nonce: string;
  redirectUri: string;
  claims: Record<string, unknown>;
  userinfo: Record<string, unknown>;
  tamper?: "nonce" | "signature" | "audience";
}
const grants = new Map<string, Grant>();
const tokens = new Map<string, Record<string, unknown>>();
let tokenRequests: URLSearchParams[] = [];

const base = `http://127.0.0.1:${IDP.port}`;
const meta = {
  issuer: IDP.issuer,
  authorization_endpoint: `${base}/authorize/`,
  token_endpoint: `${base}/token/`,
  userinfo_endpoint: `${base}/userinfo/`,
  jwks_uri: `${base}/jwks/`,
  end_session_endpoint: `${base}/end-session/`,
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
};

function readBody(req: import("node:http").IncomingMessage) {
  return new Promise<string>((res) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => res(s));
  });
}

let server: Server;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url!, base);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (url.pathname === "/application/o/plica/.well-known/openid-configuration") return send(200, meta);
    if (url.pathname === "/jwks/") return send(200, { keys: [{ ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" }] });
    if (url.pathname === "/token/" && req.method === "POST") {
      const p = new URLSearchParams(await readBody(req));
      tokenRequests.push(p);
      const basic = req.headers.authorization?.startsWith("Basic ") ? Buffer.from(req.headers.authorization.slice(6), "base64").toString() : null;
      const [id, secret] = basic ? basic.split(":").map(decodeURIComponent) : [p.get("client_id"), p.get("client_secret")];
      if (id !== "plica-client" || secret !== "plica-secret-test-only") return send(401, { error: "invalid_client" });
      const g = grants.get(p.get("code") ?? "");
      grants.delete(p.get("code") ?? "");
      if (!g || p.get("grant_type") !== "authorization_code" || p.get("redirect_uri") !== g.redirectUri) return send(400, { error: "invalid_grant" });
      const verifier = p.get("code_verifier") ?? "";
      if (b64u(createHash("sha256").update(verifier).digest()) !== g.challenge) return send(400, { error: "invalid_grant", error_description: "PKCE" });
      const now = Math.floor(Date.now() / 1000);
      const access = randomToken();
      tokens.set(access, g.userinfo);
      const idToken = jwt(
        { iss: IDP.issuer, aud: g.tamper === "audience" ? "someone-else" : "plica-client", iat: now, exp: now + 300, nonce: g.tamper === "nonce" ? "falsch" : g.nonce, ...g.claims },
        g.tamper === "signature" ? foreignKey : privateKey,
      );
      return send(200, { access_token: access, token_type: "Bearer", expires_in: 300, id_token: idToken });
    }
    if (url.pathname === "/userinfo/") {
      const info = tokens.get(req.headers.authorization?.replace(/^Bearer /, "") ?? "");
      return info ? send(200, info) : send(401, { error: "invalid_token" });
    }
    send(404, { error: "not_found" });
  });
  await new Promise<void>((r) => server.listen(IDP.port, "127.0.0.1", r));
  resetOidcDiscovery();
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  tokenRequests = [];
});

/** Vollständiger Durchlauf: Start → „Anbieter“ stellt Code aus → Rückkehr. */
async function roundTrip(claims: Record<string, unknown>, opts: { userinfo?: Record<string, unknown>; tamper?: Grant["tamper"]; state?: string; next?: string } = {}) {
  const start = await beginOidcLogin(opts.next ?? "/formulare");
  const auth = new URL(start.url);
  const code = randomToken(12);
  grants.set(code, {
    challenge: auth.searchParams.get("code_challenge")!,
    nonce: auth.searchParams.get("nonce")!,
    redirectUri: auth.searchParams.get("redirect_uri")!,
    claims,
    userinfo: opts.userinfo ?? { sub: claims.sub },
    tamper: opts.tamper,
  });
  // Der Proxy könnte eine andere Origin melden – maßgeblich ist APP_URL
  const back = new URL(`http://intern:3000/api/auth/oidc/callback?code=${code}&state=${opts.state ?? auth.searchParams.get("state")}`);
  return { auth, result: await finishOidcLogin(back, start.stateCookie) };
}

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(OidcError);
  await p.catch((e: OidcError) => expect(e.code).toBe(code));
}

/* ---------- Protokoll ---------- */

describe("OIDC-Ablauf", () => {
  it("Authorization Code mit PKCE (S256), state und nonce; Redirect-URI aus APP_URL", async () => {
    const { auth, result } = await roundTrip({ sub: "u-1", email: "Anna@Example.de", email_verified: true, name: "Anna", groups: ["plica"] });
    expect(auth.origin + auth.pathname).toBe(meta.authorization_endpoint);
    expect(auth.searchParams.get("code_challenge_method")).toBe("S256");
    expect(auth.searchParams.get("scope")).toBe("openid profile email");
    expect(auth.searchParams.get("redirect_uri")).toBe(`${config().APP_URL}/api/auth/oidc/callback`);
    expect(auth.searchParams.get("state")).toBeTruthy();
    expect(auth.searchParams.get("nonce")).toBeTruthy();
    expect(tokenRequests[0].get("code_verifier")).toBeTruthy();
    expect(result.next).toBe("/formulare");
    expect(result.idToken).toBeTruthy();
    expect(result.claims).toEqual({ sub: "u-1", email: "anna@example.de", emailVerified: true, name: "Anna", groups: ["plica"] });
  });

  it("ergänzt E-Mail und Gruppen aus UserInfo, wenn das ID-Token sie nicht enthält", async () => {
    const { result } = await roundTrip({ sub: "u-2" }, { userinfo: { sub: "u-2", email: "b@example.de", email_verified: true, preferred_username: "bert", groups: ["plica", "admin"] } });
    expect(result.claims).toMatchObject({ email: "b@example.de", emailVerified: true, name: "bert", groups: ["plica", "admin"] });
  });

  it("UserInfo mit fremdem Subjekt wird abgelehnt", async () => {
    await expectCode(roundTrip({ sub: "u-3" }, { userinfo: { sub: "jemand-anders", email: "x@example.de" } }), "sso_failed");
  });

  it("falsches state → abgelaufen", async () => {
    await expectCode(roundTrip({ sub: "u-4" }, { state: "manipuliert" }), "sso_expired");
  });

  it("falsche nonce, fremde Signatur oder falsche Audience → fehlgeschlagen", async () => {
    await expectCode(roundTrip({ sub: "u-5" }, { tamper: "nonce" }), "sso_failed");
    await expectCode(roundTrip({ sub: "u-5" }, { tamper: "signature" }), "sso_failed");
    await expectCode(roundTrip({ sub: "u-5" }, { tamper: "audience" }), "sso_failed");
  });

  it("Zustands-Cookie fehlt, ist manipuliert oder abgelaufen", async () => {
    const back = new URL(`${config().APP_URL}/api/auth/oidc/callback?code=x&state=y`);
    await expectCode(finishOidcLogin(back, undefined), "sso_expired");
    await expectCode(finishOidcLogin(back, "kaputt"), "sso_expired");
    const old = encrypt(JSON.stringify({ verifier: "v", state: "y", nonce: "n", next: "/", exp: Date.now() - 1 }), "oidc-state");
    await expectCode(finishOidcLogin(back, old), "sso_expired");
  });

  it("Fehler vom Anbieter", async () => {
    const start = await beginOidcLogin("/");
    await expectCode(finishOidcLogin(new URL(`${config().APP_URL}/api/auth/oidc/callback?error=access_denied`), start.stateCookie), "sso_denied");
    await expectCode(finishOidcLogin(new URL(`${config().APP_URL}/api/auth/oidc/callback?error=invalid_request`), start.stateCookie), "sso_failed");
  });

  it("Code ist nur einmal einlösbar", async () => {
    const start = await beginOidcLogin("/");
    const auth = new URL(start.url);
    grants.set("einmal", { challenge: auth.searchParams.get("code_challenge")!, nonce: auth.searchParams.get("nonce")!, redirectUri: auth.searchParams.get("redirect_uri")!, claims: { sub: "u-6" }, userinfo: { sub: "u-6" } });
    const back = new URL(`${config().APP_URL}/api/auth/oidc/callback?code=einmal&state=${auth.searchParams.get("state")}`);
    await finishOidcLogin(back, start.stateCookie);
    await expectCode(finishOidcLogin(back, start.stateCookie), "sso_failed");
  });

  it("Rücksprungziel bleibt in der Anwendung", () => {
    expect(safeNextPath("/formulare/abc?x=1")).toBe("/formulare/abc?x=1");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/..//evil.example", "/%2e%2e//evil", "javascript:alert(1)", "/a\nb", 42, null]) expect(safeNextPath(bad)).toBe("/");
  });

  it("Abmelden beim Anbieter über end_session_endpoint", async () => {
    const { result } = await roundTrip({ sub: "u-7" });
    expect(result.idToken).toMatch(/^ey/);
    const url = new URL((await endSessionUrl(result.idToken))!);
    expect(url.origin + url.pathname).toBe(meta.end_session_endpoint);
    expect(url.searchParams.get("id_token_hint")).toBe(result.idToken);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(`${config().APP_URL}/login`);
    expect(url.searchParams.get("client_id")).toBe("plica-client");
    // Ohne ID-Token kein Rücksprung (würde der Anbieter ablehnen)
    expect(new URL((await endSessionUrl(null))!).searchParams.has("post_logout_redirect_uri")).toBe(false);
  });
});

/* ---------- Konten und Rollen ---------- */

describe("Kontozuordnung", () => {
  const c = (over: Partial<OidcConfig> = {}): OidcConfig => ({ ...config().oidc!, ...over });
  const claims = (over: Partial<OidcClaims> = {}): OidcClaims => ({ sub: randomToken(8), email: `${randomToken(6).toLowerCase()}@sso.test`, emailVerified: true, name: "SSO Person", groups: ["plica"], ...over });
  let defaultWs: string;

  beforeAll(async () => {
    await makeWorkspace("Irgendein Workspace");
    defaultWs = (await db.query.workspaces.findFirst({ orderBy: asc(schema.workspaces.createdAt) }))!.id;
  });
  const roleIn = async (userId: string, ws = defaultWs) => (await db.query.memberships.findFirst({ where: (m, { and, eq }) => and(eq(m.workspaceId, ws), eq(m.userId, userId)) }))?.role ?? null;

  it("legt Konto an (nur mit bestätigter E-Mail) und vergibt die Standardrolle", async () => {
    const cl = claims();
    const u = await resolveOidcUser(cl, c());
    expect(u.oidcSubject).toBe(`${c().issuer}|${cl.sub}`);
    expect(u.passwordHash).toBe("");
    expect(await roleIn(u.id)).toBe("editor");
    // Zweite Anmeldung: dasselbe Konto über sub, auch wenn sich die E-Mail beim Anbieter geändert hat
    const again = await resolveOidcUser({ ...cl, email: "neu@sso.test" }, c());
    expect(again.id).toBe(u.id);
    await expectCode(resolveOidcUser(claims({ emailVerified: false }), c()), "sso_email_unverified");
  });

  it("ohne automatische Anlage: kein Konto", async () => {
    await expectCode(resolveOidcUser(claims(), c({ autoCreate: false })), "sso_no_account");
  });

  it("Gruppenfilter: nur erlaubte Gruppen oder Admin-Gruppen", async () => {
    await expectCode(resolveOidcUser(claims({ groups: ["andere"] }), c()), "sso_group");
    await expectCode(resolveOidcUser(claims({ groups: [] }), c()), "sso_group");
    const admin = await resolveOidcUser(claims({ groups: ["admin"] }), c());
    expect(await roleIn(admin.id)).toBe("admin");
    // leerer Filter = alle
    const any = await resolveOidcUser(claims({ groups: [] }), c({ allowedGroups: [] }));
    expect(await roleIn(any.id)).toBe("editor");
  });

  it("verknüpft bestehendes Konto per E-Mail nur bei email_verified=true", async () => {
    const { user } = await makeWorkspace("Lokal");
    await expectCode(resolveOidcUser(claims({ email: user.email.toUpperCase(), emailVerified: false }), c()), "sso_email_unverified");
    expect((await db.query.users.findFirst({ where: eq(schema.users.id, user.id) }))!.oidcSubject).toBeNull();
    const linked = await resolveOidcUser(claims({ email: user.email }), c());
    expect(linked.id).toBe(user.id);
    // Ein zweites Subjekt mit derselben Adresse darf das Konto nicht übernehmen
    await expectCode(resolveOidcUser(claims({ email: user.email }), c()), "sso_conflict");
  });

  it("gesperrte Konten kommen nicht herein", async () => {
    const cl = claims();
    const u = await resolveOidcUser(cl, c());
    await db.update(schema.users).set({ disabledAt: new Date() }).where(eq(schema.users.id, u.id));
    await expectCode(resolveOidcUser(cl, c()), "sso_disabled_user");
  });

  it("zieht Rollen bei jeder Anmeldung aus den Gruppen nach", async () => {
    const cl = claims({ groups: ["plica", "admin"] });
    const u = await resolveOidcUser(cl, c());
    expect(await roleIn(u.id)).toBe("admin");
    await resolveOidcUser({ ...cl, groups: ["plica"] }, c());
    expect(await roleIn(u.id)).toBe("editor");
    // Ohne Standardrolle bestimmen die Gruppen nur Admins; sonst bleibt die Rolle unverändert
    await db.update(schema.memberships).set({ role: "viewer" }).where(eq(schema.memberships.userId, u.id));
    await resolveOidcUser({ ...cl, groups: ["plica"] }, c({ defaultRole: null }));
    expect(await roleIn(u.id)).toBe("viewer");
  });

  it("der letzte Inhaber wird nie herabgestuft, ein weiterer Inhaber schon", async () => {
    const owners = await db.query.memberships.findMany({ where: (m, { and, eq }) => and(eq(m.workspaceId, defaultWs), eq(m.role, "owner")) });
    expect(owners.length).toBe(1);
    const ownerId = owners[0].userId;
    await syncDefaultWorkspaceRole(ownerId, ["plica"], c());
    expect(await roleIn(ownerId)).toBe("owner");
    // Inhaber in der Admin-Gruppe bleibt Inhaber
    await syncDefaultWorkspaceRole(ownerId, ["admin"], c());
    expect(await roleIn(ownerId)).toBe("owner");

    const second = await resolveOidcUser(claims(), c());
    await db.update(schema.memberships).set({ role: "owner" }).where(eq(schema.memberships.userId, second.id));
    await syncDefaultWorkspaceRole(second.id, ["plica"], c());
    expect(await roleIn(second.id)).toBe("editor");
    expect(await roleIn(ownerId)).toBe("owner");
  });

  it("gleichzeitige Herabstufung zweier Inhaber lässt einen übrig", async () => {
    const a = await resolveOidcUser(claims(), c());
    const ws = await makeWorkspace("Zwei Inhaber");
    // Eigener „Standard-Workspace“ ist der älteste; hier direkt zwei zusätzliche Inhaber im Standard-Workspace
    await db.update(schema.memberships).set({ role: "owner" }).where(eq(schema.memberships.userId, a.id));
    await db.insert(schema.memberships).values({ workspaceId: defaultWs, userId: ws.user.id, role: "owner" });
    const before = (await db.query.memberships.findMany({ where: (m, { and, eq }) => and(eq(m.workspaceId, defaultWs), eq(m.role, "owner")) })).length;
    const ids = (await db.query.memberships.findMany({ where: (m, { and, eq }) => and(eq(m.workspaceId, defaultWs), eq(m.role, "owner")) })).map((m) => m.userId);
    await Promise.all(ids.map((id) => syncDefaultWorkspaceRole(id, ["plica"], c())));
    const after = (await db.query.memberships.findMany({ where: (m, { and, eq }) => and(eq(m.workspaceId, defaultWs), eq(m.role, "owner")) })).length;
    expect(before).toBeGreaterThanOrEqual(3);
    expect(after).toBe(1);
  });
});
