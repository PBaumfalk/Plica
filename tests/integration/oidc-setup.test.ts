/**
 * Vor der Ersteinrichtung darf keine SSO-Anmeldung ein Konto anlegen –
 * sonst ließe sich der Einrichtungscode umgehen.
 */
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.OIDC_ISSUER = "http://127.0.0.1:4783/application/o/plica/";
  process.env.OIDC_CLIENT_ID = "plica-client";
  process.env.OIDC_CLIENT_SECRET = "plica-secret-test-only";
  process.env.OIDC_AUTO_CREATE_USERS = "true";
  process.env.OIDC_DEFAULT_ROLE = "editor";
});
vi.mock("@/server/setup", () => ({ needsSetup: async () => true }));

import { resolveOidcUser } from "@/server/auth/oidc";

describe("SSO vor der Ersteinrichtung", () => {
  it("wird abgewiesen, auch mit automatischer Anlage", async () => {
    await expect(resolveOidcUser({ sub: "erster", email: "erster@sso.test", emailVerified: true, name: "Erster", groups: [] })).rejects.toMatchObject({ code: "sso_setup_pending" });
  });
});
