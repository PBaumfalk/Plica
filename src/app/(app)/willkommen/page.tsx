import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { TEMPLATES } from "@/lib/templates";
import { Welcome } from "@/components/templates/welcome";

export const metadata = { title: "Willkommen" };

export default async function WelcomePage() {
  const v = await requireViewer();
  return <Welcome name={v.user.name.split(" ")[0]} workspace={v.workspace.name} canWrite={can(v.role, "forms.write")} templates={TEMPLATES.map((t) => ({ name: t.name, icon: t.icon }))} />;
}
