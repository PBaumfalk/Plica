"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertViewer, createSession, getViewer } from "../auth/session";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { escapeHtml, mailConfigured, sendMail } from "../mail/mailer";
import { ROLE_LABELS } from "../auth/rbac";
import * as team from "../workspaces/team";
import { serviceAction } from "../workspaces/action-helpers";
import { ServiceError } from "../workspaces/errors";
import { ok, type ActionResult } from "./result";

const RoleInput = z.enum(["admin", "editor", "reviewer", "viewer"]);
const actorOf = (v: Awaited<ReturnType<typeof assertViewer>>) => ({ userId: v.user.id, workspaceId: v.workspace.id, role: v.role });

export async function inviteMemberAction(input: { email: string; role: string; sendEmail: boolean }): Promise<ActionResult<{ link: string; emailed: boolean; emailError?: string }>> {
  return serviceAction(async () => {
    const v = await assertViewer("members.manage");
    const role = RoleInput.parse(input.role);
    const inv = await team.createInvitation(actorOf(v), String(input.email ?? ""), role);
    let emailed = false;
    let emailError: string | undefined;
    if (input.sendEmail) {
      if (!mailConfigured()) emailError = "E-Mail-Versand ist nicht eingerichtet. Teile den Link direkt.";
      else {
        try {
          const text = `${v.user.name} lädt dich in den Workspace „${v.workspace.name}“ bei PLICA ein (Rolle: ${ROLE_LABELS[role].name}).\n\nEinladung annehmen:\n${inv.link}\n\nDer Link ist 7 Tage gültig und nur einmal verwendbar.`;
          await sendMail({
            to: inv.email,
            subject: `Einladung zu ${v.workspace.name}`,
            text,
            html: `<p>${escapeHtml(v.user.name)} lädt dich in den Workspace „${escapeHtml(v.workspace.name)}“ bei PLICA ein (Rolle: ${escapeHtml(ROLE_LABELS[role].name)}).</p><p><a href="${escapeHtml(inv.link)}">Einladung annehmen</a></p><p style="color:#5b626d">Der Link ist 7 Tage gültig und nur einmal verwendbar.</p>`,
          });
          emailed = true;
        } catch (e) {
          console.error("[invite mail]", e);
          emailError = "Die E-Mail konnte nicht gesendet werden. Teile den Link direkt.";
        }
      }
    }
    revalidatePath("/einstellungen/team");
    return ok({ link: inv.link, emailed, emailError });
  });
}

export async function revokeInvitationAction(id: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer("members.manage");
    await team.revokeInvitation(actorOf(v), id);
    revalidatePath("/einstellungen/team");
    return ok(null);
  });
}

export async function changeRoleAction(userId: string, role: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer("members.manage");
    const r = z.enum(["owner", "admin", "editor", "reviewer", "viewer"]).parse(role);
    await team.changeRole(actorOf(v), String(userId), r);
    revalidatePath("/einstellungen/team");
    return ok(null);
  });
}

export async function removeMemberAction(userId: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer("members.manage");
    await team.removeMember(actorOf(v), String(userId));
    revalidatePath("/einstellungen/team");
    return ok(null);
  });
}

export async function transferOwnershipAction(userId: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    await team.transferOwnership(actorOf(v), String(userId));
    revalidatePath("/einstellungen", "layout");
    return ok(null);
  });
}

export async function leaveWorkspaceAction(): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await assertViewer();
    await team.leaveWorkspace(actorOf(v));
    revalidatePath("/", "layout");
    return ok(null);
  });
}

/* ---------- Einladung annehmen ---------- */

export async function acceptInvitationAction(token: string): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const v = await getViewer();
    if (!v || v.mfaPending) throw new ServiceError("Bitte melde dich zuerst an.");
    const wsId = await team.acceptAsExistingUser(String(token), { id: v.user.id, email: v.user.email });
    await db.update(schema.sessions).set({ workspaceId: wsId }).where(eq(schema.sessions.id, v.sessionId));
    return ok(null);
  });
}

export async function registerWithInvitationAction(input: { token: string; name: string; password: string }): Promise<ActionResult<null>> {
  return serviceAction(async () => {
    const { userId, workspaceId } = await team.acceptAsNewUser(String(input.token), String(input.name ?? ""), String(input.password ?? ""));
    await createSession(userId, { workspaceId });
    return ok(null);
  });
}
