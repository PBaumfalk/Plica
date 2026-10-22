"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertViewer, getViewer } from "../auth/session";
import * as account from "../workspaces/account";
import * as ws from "../workspaces/workspace";
import { serviceAction } from "../workspaces/action-helpers";
import { ServiceError } from "../workspaces/errors";
import { ok, type ActionResult } from "./result";

const actorOf = (v: Awaited<ReturnType<typeof assertViewer>>) => ({ userId: v.user.id, workspaceId: v.workspace.id, role: v.role });

export async function updateProfileAction(input: { name: string; email: string; password?: string }): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    await account.updateProfile(v.user.id, { name: String(input.name ?? ""), email: String(input.email ?? ""), password: input.password ? String(input.password) : undefined });
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function revokeSessionAction(idPrefix: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    await account.revokeSession(v.user.id, v.sessionId, String(idPrefix));
    revalidatePath("/einstellungen/konto");
    return ok(null);
  });
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    const count = await account.revokeOtherSessions(v.user.id, v.sessionId);
    revalidatePath("/einstellungen/konto");
    return ok({ count });
  });
}

export async function createWorkspaceAction(name: string): Promise<ActionResult<{ id: string }>> {
  return serviceAction(async () => {
    // Auch ohne aktuellen Workspace erlaubt (z. B. nach Entfernung aus dem Team)
    const v = await getViewer();
    if (!v || v.mfaPending) throw new ServiceError("Bitte melde dich erneut an.");
    const w = await ws.createWorkspace(v.user.id, String(name ?? ""));
    await ws.switchWorkspace(v.sessionId, v.user.id, w.id);
    revalidatePath("/", "layout");
    return ok({ id: w.id });
  });
}

export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await getViewer();
    if (!v || v.mfaPending) throw new ServiceError("Bitte melde dich erneut an.");
    await ws.switchWorkspace(v.sessionId, v.user.id, String(workspaceId));
    revalidatePath("/", "layout");
    return ok(null);
  });
}

const WsInput = z.object({ name: z.string(), retentionDays: z.number().int().nullable() });

export async function updateWorkspaceAction(input: z.input<typeof WsInput>): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer("workspace.manage");
    await ws.updateWorkspace(actorOf(v), WsInput.parse(input));
    revalidatePath("/", "layout");
    return ok(null);
  });
}

export async function deleteWorkspaceAction(confirmName: string): Promise<ActionResult<{ storageErrors: number }>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    const r = await ws.deleteWorkspace(actorOf(v), String(confirmName ?? ""));
    await ws.switchWorkspace(v.sessionId, v.user.id, r.nextWorkspaceId);
    revalidatePath("/", "layout");
    return ok({ storageErrors: r.storageErrors });
  });
}

export async function listWorkspacesAction(): Promise<ActionResult<{ id: string; name: string; role: string; current: boolean }[]>> {
  return serviceAction(async () => {
    const v = await getViewer();
    if (!v || v.mfaPending) throw new ServiceError("Bitte melde dich erneut an.");
    const rows = await ws.listMyWorkspaces(v.user.id);
    return ok(rows.map((r) => ({ id: r.id, name: r.name, role: r.role, current: r.id === v.workspace?.id })));
  });
}
