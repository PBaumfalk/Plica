import { TEMPLATES } from "@/lib/templates";
import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { TemplateGallery } from "@/components/templates/gallery";

export const metadata = { title: "Vorlagen" };

export default async function TemplatesPage() {
  const v = await requireViewer();
  const items = TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, category: t.category, icon: t.icon, definition: t.build() }));
  return <TemplateGallery items={items} canWrite={can(v.role, "forms.write")} />;
}
