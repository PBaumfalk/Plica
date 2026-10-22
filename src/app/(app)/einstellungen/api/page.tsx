import { desc, eq } from "drizzle-orm";
import { requireViewer } from "@/server/auth/session";
import { config } from "@/server/config";
import { db, schema } from "@/server/db";
import { ApiSettings } from "@/components/automations/api-settings";

export const metadata = { title: "API und Webhooks" };

export default async function ApiSettingsPage() {
  const v = await requireViewer("tokens.manage");
  const tokens = await db
    .select({ t: schema.apiTokens, owner: schema.users.name })
    .from(schema.apiTokens)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiTokens.userId))
    .where(eq(schema.apiTokens.workspaceId, v.workspace.id))
    .orderBy(desc(schema.apiTokens.createdAt));
  return (
    <ApiSettings
      baseUrl={`${config().APP_URL}/api/v1`}
      tokens={tokens.map(({ t, owner }) => ({
        id: t.id,
        name: t.name,
        prefix: t.prefix,
        scope: t.scope,
        owner,
        createdAt: t.createdAt.toISOString(),
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        revokedAt: t.revokedAt?.toISOString() ?? null,
      }))}
    />
  );
}
