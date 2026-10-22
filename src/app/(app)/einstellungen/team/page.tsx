import { requireViewer } from "@/server/auth/session";
import { can, canAssign } from "@/server/auth/rbac";
import { listInvitations, listMembers } from "@/server/workspaces/team";
import { mailConfigured } from "@/server/mail/mailer";
import { Section, Stack } from "@/components/settings/section";
import { InviteForm, InvitationsList, LeaveWorkspace, MembersList } from "@/components/settings/team";
import type { Role } from "@/server/db/schema";

export const metadata = { title: "Team" };

const ROLES: Role[] = ["owner", "admin", "editor", "reviewer", "viewer"];

export default async function TeamPage() {
  const v = await requireViewer();
  const manage = can(v.role, "members.manage");
  const [members, invitations] = await Promise.all([listMembers(v.workspace.id), manage ? listInvitations(v.workspace.id) : Promise.resolve([])]);
  const owners = members.filter((m) => m.role === "owner").length;
  return (
    <Stack>
      <Section id="mitglieder" title="Mitglieder" description={`${members.length} ${members.length === 1 ? "Person hat" : "Personen haben"} Zugriff auf „${v.workspace.name}“. Rollen gelten nur in diesem Workspace.`}>
        <MembersList
          me={v.user.id}
          myRole={v.role}
          members={members.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
            role: m.role,
            totp: m.totpEnabled,
            lastLoginAt: m.lastLoginAt ? new Date(m.lastLoginAt).toISOString() : null,
            manageable: manage && m.userId !== v.user.id && canAssign(v.role, m.role),
            assignable: ROLES.filter((r) => r !== "owner" && canAssign(v.role, r)),
          }))}
        />
      </Section>
      {manage && (
        <Section id="einladen" title="Person einladen" description="Der Einladungslink ist 7 Tage gültig und nur einmal verwendbar. Die eingeladene Person muss sich mit genau dieser E-Mail-Adresse anmelden.">
          <InviteForm roles={ROLES.filter((r) => r !== "owner" && canAssign(v.role, r))} mail={mailConfigured()} />
          {invitations.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-[13px] font-medium text-muted">Offene Einladungen</h3>
              <InvitationsList invitations={invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expiresAt.toISOString(), invitedBy: i.invitedBy }))} />
            </div>
          )}
        </Section>
      )}
      {!(v.role === "owner" && owners <= 1) && (
        <Section id="verlassen" title="Workspace verlassen" description="Du verlierst sofort den Zugriff auf alle Formulare und Antworten in diesem Workspace.">
          <LeaveWorkspace workspace={v.workspace.name} />
        </Section>
      )}
    </Stack>
  );
}
