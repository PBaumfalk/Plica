/**
 * OIDC gegen ein echtes authentik: Browser (Chromium) → authentik-Anmeldeformular
 * → Rückkehr mit Code. Die Rückkehr wird im Browser abgefangen und an
 * finishOidcLogin/resolveOidcUser übergeben (Discovery, PKCE, JWKS, Gruppen
 * im profile-Scope, email_verified).
 *
 * Wird übersprungen, wenn AUTHENTIK_URL nicht gesetzt ist. Voraussetzungen:
 *   AUTHENTIK_URL=http://127.0.0.1:4785   (authentik 2026.8.x, nur lokal gebunden)
 *   AUTHENTIK_TOKEN=…                     (z. B. AUTHENTIK_BOOTSTRAP_TOKEN)
 * Der Test legt Provider, Application, Gruppen, Scope-Mapping und Benutzer mit
 * eindeutigem Präfix an und räumt sie danach wieder ab.
 */
import { chromium, type Browser } from "@playwright/test";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const AK = vi.hoisted(() => {
  const url = process.env.AUTHENTIK_URL?.replace(/\/+$/, "");
  const tag = `plica${Date.now().toString(36)}`;
  if (url) {
    process.env.OIDC_ISSUER = `${url}/application/o/${tag}/`;
    process.env.OIDC_CLIENT_ID = `${tag}-client`;
    process.env.OIDC_CLIENT_SECRET = `${tag}-secret-test-only-0123456789abcdef`;
    process.env.OIDC_ALLOWED_GROUPS = `${tag}-users`;
    process.env.OIDC_ADMIN_GROUPS = `${tag}-admins`;
    process.env.OIDC_AUTO_CREATE_USERS = "true";
    process.env.OIDC_DEFAULT_ROLE = "editor";
  }
  return { url, tag, token: process.env.AUTHENTIK_TOKEN ?? "" };
});

import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { beginOidcLogin, finishOidcLogin, OidcError, resolveOidcUser } from "@/server/auth/oidc";
import { makeWorkspace } from "./helpers";

const PW = `Test-Passwort-${AK.tag}`;

async function ak(method: string, path: string, body?: unknown) {
  const r = await fetch(`${AK.url}/api/v3${path}`, { method, headers: { authorization: `Bearer ${AK.token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  if (!r.ok) throw new Error(`authentik ${method} ${path}: ${r.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

describe.skipIf(!AK.url)("OIDC mit echtem authentik", () => {
  const cleanup: string[] = [];
  const users: Record<string, { email: string; username: string }> = {};
  let browser: Browser;

  beforeAll(async () => {
    const flows = (await ak("GET", "/flows/instances/?designation=authorization")).results;
    const authz = flows.find((f: { slug: string }) => f.slug === "default-provider-authorization-implicit-consent").pk;
    const inval = (await ak("GET", "/flows/instances/?slug=default-provider-invalidation-flow")).results[0].pk;
    const key = (await ak("GET", "/crypto/certificatekeypairs/?has_key=true")).results[0].pk;
    const scopes = (await ak("GET", "/propertymappings/provider/scope/")).results;
    const std = scopes.filter((m: { managed: string; scope_name: string }) => m.managed && ["openid", "profile"].includes(m.scope_name)).map((m: { pk: string }) => m.pk);
    // Das mitgelieferte Mapping „email“ meldet email_verified immer false – eigenes Mapping wie im Handbuch
    const mail = await ak("POST", "/propertymappings/provider/scope/", {
      name: `${AK.tag} email (verified)`,
      scope_name: "email",
      expression: 'return {"email": request.user.email, "email_verified": bool(request.user.attributes.get("email_verified", False))}',
    });
    cleanup.push(`/propertymappings/provider/scope/${mail.pk}/`);
    const prov = await ak("POST", "/providers/oauth2/", {
      name: `${AK.tag} PLICA`,
      authorization_flow: authz,
      invalidation_flow: inval,
      client_type: "confidential",
      // Ohne ausdrücklichen Grant-Type antwortet authentik 2026.8 mit error=invalid_request
      grant_types: ["authorization_code"],
      client_id: process.env.OIDC_CLIENT_ID,
      client_secret: process.env.OIDC_CLIENT_SECRET,
      signing_key: key,
      property_mappings: [...std, mail.pk],
      redirect_uris: [{ matching_mode: "strict", url: `${config().APP_URL}/api/auth/oidc/callback` }],
    });
    cleanup.push(`/providers/oauth2/${prov.pk}/`);
    await ak("POST", "/core/applications/", { name: `${AK.tag} PLICA`, slug: AK.tag, provider: prov.pk });
    cleanup.unshift(`/core/applications/${AK.tag}/`);

    const gUsers = await ak("POST", "/core/groups/", { name: `${AK.tag}-users` });
    const gAdmins = await ak("POST", "/core/groups/", { name: `${AK.tag}-admins` });
    cleanup.unshift(`/core/groups/${gUsers.pk}/`, `/core/groups/${gAdmins.pk}/`);
    // [E-Mail bestätigt, Gruppen]
    const spec: Record<string, [boolean, string[]]> = { anna: [true, [gUsers.pk]], bernd: [false, [gUsers.pk]], carla: [true, []], dora: [true, [gAdmins.pk]] };
    for (const [n, [verified, groups]] of Object.entries(spec)) {
      const username = `${AK.tag}-${n}`;
      const email = `${n}.${AK.tag}@example.test`;
      const u = await ak("POST", "/core/users/", { username, name: n[0].toUpperCase() + n.slice(1), email, is_active: true, path: "users", attributes: { email_verified: verified }, groups });
      await ak("POST", `/core/users/${u.pk}/set_password/`, { password: PW });
      cleanup.unshift(`/core/users/${u.pk}/`);
      users[n] = { email, username };
    }
    await makeWorkspace("Standard");
    browser = await chromium.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    for (const p of cleanup) await ak("DELETE", p).catch((e) => console.warn(String(e)));
  });

  /** Anmeldung im authentik-Formular; liefert die Rückkehr-URL, ohne PLICA aufzurufen. */
  async function login(n: string) {
    const start = await beginOidcLogin("/");
    const ctx = await browser.newContext({ locale: "de-DE" });
    let callback: URL | null = null;
    // Playwright leitet Weiterleitungen nicht durch route(); daher jede Anfrage beobachten. PLICA läuft
    // hier nicht – der Aufruf der Rückkehr-URL scheitert, ihre Parameter genügen.
    ctx.on("request", (r) => {
      if (r.url().startsWith(`${config().APP_URL}/`)) callback ??= new URL(r.url());
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15_000);
    await page.goto(start.url).catch(() => {});
    if (!callback) {
      await page.locator("input[name=uidField]").fill(users[n].username);
      await page.locator("input[name=uidField]").press("Enter");
      const pw = page.locator("ak-stage-password input[name=password]");
      await pw.fill(PW);
      await pw.press("Enter").catch(() => {});
    }
    await expect.poll(() => callback, { timeout: 30_000 }).not.toBeNull();
    await ctx.close();
    const back = callback as unknown as URL;
    expect(back.pathname).toBe("/api/auth/oidc/callback");
    return finishOidcLogin(back, start.stateCookie);
  }

  const roleOf = async (userId: string) => (await db.query.memberships.findFirst({ where: eq(schema.memberships.userId, userId) }))?.role;

  it("bestätigte E-Mail und erlaubte Gruppe: Konto wird angelegt (Standardrolle)", async () => {
    const { claims } = await login("anna");
    expect(claims).toMatchObject({ email: users.anna.email, emailVerified: true, name: "Anna", groups: [`${AK.tag}-users`] });
    const u = await resolveOidcUser(claims);
    expect(u.oidcSubject).toBe(`${config().oidc!.issuer}|${claims.sub}`);
    expect(await roleOf(u.id)).toBe("editor");
    // Zweite Anmeldung findet dasselbe Konto über sub
    const again = await resolveOidcUser((await login("anna")).claims);
    expect(again.id).toBe(u.id);
  });

  it("Admin-Gruppe ergibt die Rolle Administrator", async () => {
    const u = await resolveOidcUser((await login("dora")).claims);
    expect(await roleOf(u.id)).toBe("admin");
  });

  it("unbestätigte E-Mail: kein Konto", async () => {
    const { claims } = await login("bernd");
    expect(claims.emailVerified).toBe(false);
    await expect(resolveOidcUser(claims)).rejects.toMatchObject({ code: "sso_email_unverified" });
  });

  it("ohne erlaubte Gruppe: abgewiesen", async () => {
    const { claims } = await login("carla");
    await expect(resolveOidcUser(claims)).rejects.toBeInstanceOf(OidcError);
    await expect(resolveOidcUser(claims)).rejects.toMatchObject({ code: "sso_group" });
    expect(await db.query.users.findFirst({ where: eq(schema.users.email, users.carla.email) })).toBeUndefined();
  });
});
