import { getViewer } from "@/server/auth/session";
import { findInvitation } from "@/server/workspaces/team";
import { ROLE_LABELS } from "@/server/auth/rbac";
import { AcceptInvitation } from "./accept";

export const metadata = { title: "Einladung" };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findInvitation(token);
  if (!inv || !inv.valid) {
    return (
      <div className="rounded-lg bg-paper p-7 shadow-sheet">
        <h1 className="font-display text-[26px] leading-tight font-[450]">Einladung nicht gültig</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{inv?.acceptedAt ? "Diese Einladung wurde bereits verwendet." : inv ? "Diese Einladung ist abgelaufen." : "Diesen Einladungslink gibt es nicht."} Bitte die Person, die dich eingeladen hat, um einen neuen Link.</p>
      </div>
    );
  }
  const v = await getViewer();
  const viewer = v && !v.mfaPending ? { name: v.user.name, email: v.user.email } : null;
  return (
    <AcceptInvitation
      token={token}
      workspace={inv.workspace}
      invitedBy={inv.invitedBy}
      email={inv.email}
      role={ROLE_LABELS[inv.role].name}
      roleDescription={ROLE_LABELS[inv.role].description}
      viewer={viewer}
    />
  );
}
