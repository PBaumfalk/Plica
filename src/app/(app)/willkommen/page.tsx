import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { TEMPLATES } from "@/lib/templates";
import { Welcome } from "@/components/templates/welcome";
import { greetingName } from "@/lib/names";

export const metadata = { title: "Willkommen" };

export default async function WelcomePage() {
  const v = await requireViewer();
  return <Welcome name={greetingName(v.user.name)} workspace={v.workspace.name} canWrite={can(v.role, "forms.write")} templates={TEMPLATES.map((t) => ({ id: t.id, name: t.name, icon: t.icon }))} />;
}
