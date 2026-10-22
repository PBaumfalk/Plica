"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../audit";
import { assertViewer } from "../auth/session";
import { db, schema } from "../db";
import { newApiToken } from "../api/tokens";
import { decrypt, encrypt, randomToken } from "../lib/crypto";
import { action, fail, ok, type ActionResult } from "./result";

const Create = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(80),
  scope: z.enum(["read", "write"]),
  expiresInDays: z.number().int().min(1).max(3650).nullable(),
});

export async function createApiTokenAction(input: z.input<typeof Create>): Promise<ActionResult<{ token: string }>> {
  return action(async () => {
    const v = await assertViewer("tokens.manage");
    const data = Create.parse(input);
    const t = newApiToken();
    const [row] = await db
      .insert(schema.apiTokens)
      .values({ workspaceId: v.workspace.id, userId: v.user.id, name: data.name, scope: data.scope, tokenHash: t.hash, prefix: t.prefix, expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86_400_000) : null })
      .returning({ id: schema.apiTokens.id });
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "api_token.created", targetType: "api_token", targetId: row.id, meta: { scope: data.scope } });
    revalidatePath("/einstellungen/api");
    return ok({ token: t.token });
  });
}

export async function revokeApiTokenAction(tokenId: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer("tokens.manage");
    if (!/^[0-9a-f-]{36}$/.test(tokenId)) return fail("Schlüssel nicht gefunden.");
    const r = await db
      .update(schema.apiTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.apiTokens.id, tokenId), eq(schema.apiTokens.workspaceId, v.workspace.id), isNull(schema.apiTokens.revokedAt)))
      .returning({ id: schema.apiTokens.id });
    if (!r.length) return fail("Schlüssel nicht gefunden oder bereits widerrufen.");
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "api_token.revoked", targetType: "api_token", targetId: tokenId });
    revalidatePath("/einstellungen/api");
    return ok(null);
  });
}

export async function revealWebhookSecretAction(): Promise<ActionResult<{ secret: string }>> {
  return action(async () => {
    const v = await assertViewer("tokens.manage");
    const ws = await db.query.workspaces.findFirst({ where: eq(schema.workspaces.id, v.workspace.id) });
    if (!ws) return fail("Workspace nicht gefunden.");
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "webhook_secret.revealed" });
    return ok({ secret: decrypt(ws.webhookSecret, "webhook") });
  });
}

export async function rotateWebhookSecretAction(): Promise<ActionResult<{ secret: string }>> {
  return action(async () => {
    const v = await assertViewer("tokens.manage");
    const secret = randomToken(32);
    await db.update(schema.workspaces).set({ webhookSecret: encrypt(secret, "webhook") }).where(eq(schema.workspaces.id, v.workspace.id));
    await audit({ workspaceId: v.workspace.id, userId: v.user.id, action: "webhook_secret.rotated" });
    return ok({ secret });
  });
}
