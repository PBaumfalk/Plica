import { requireViewer } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const v = await requireViewer();
  const items = [
    { href: "/einstellungen/konto", label: "Konto" },
    { href: "/einstellungen/team", label: "Team" },
    ...(can(v.role, "workspace.manage") ? [{ href: "/einstellungen/workspace", label: "Workspace" }] : []),
    ...(can(v.role, "audit.read") ? [{ href: "/einstellungen/protokoll", label: "Protokoll" }] : []),
    ...(can(v.role, "tokens.manage") ? [{ href: "/einstellungen/api", label: "API und Webhooks" }] : []),
  ];
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="pb-6">
        <div className="mb-1 text-[12.5px] font-medium text-muted">{v.workspace.name}</div>
        <h1 className="font-display text-[30px] leading-tight font-[450] tracking-[-0.015em]">Einstellungen</h1>
      </header>
      <div className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
        <SettingsNav items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
