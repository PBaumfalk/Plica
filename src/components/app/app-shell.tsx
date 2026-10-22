"use client";
import { CheckCheck, FileStack, FileText, LayoutTemplate, LogOut, Moon, Plus, Settings, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useTransition, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, TooltipProvider, Kbd } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";
import { logout } from "@/server/actions/auth";
import { createFormAction } from "@/server/actions/forms";
import { CommandProvider, useOpenPalette, type Cmd } from "./command-palette";
import { LogoMark } from "./logo";
import { applyTheme, ThemeSwitch } from "./theme";
import type { Role } from "@/server/db/schema";
import { ROLE_LABELS } from "@/server/auth/rbac";
import { WorkspaceSwitcher } from "@/components/settings/workspace-switcher";

const NAV = [
  { href: "/", label: "Formulare", icon: FileStack, match: (p: string) => p === "/" || p.startsWith("/formulare") },
  { href: "/freigaben", label: "Freigaben", icon: CheckCheck, match: (p: string) => p.startsWith("/freigaben") },
  { href: "/vorlagen", label: "Vorlagen", icon: LayoutTemplate, match: (p: string) => p.startsWith("/vorlagen") },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings, match: (p: string) => p.startsWith("/einstellungen") },
];

export function useCreateForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    create: (definition?: unknown) =>
      start(async () => {
        const r = await createFormAction(definition ? { definition } : undefined);
        if (!r.ok) return void toast.error(r.error);
        router.push(`/formulare/${r.data.id}/bearbeiten`);
      }),
  };
}

export function AppShell({ children, user, workspace, role, forms, pendingApprovals, canCreate }: { children: ReactNode; user: { name: string; email: string }; workspace: string; role: Role; forms: { id: string; title: string }[]; pendingApprovals: number; canCreate: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const { create } = useCreateForm();
  // Der Editor nutzt die volle Fläche
  const fullscreen = /^\/formulare\/[^/]+\/bearbeiten/.test(path);

  const base = useMemo<Cmd[]>(
    () => [
      ...(canCreate ? [{ id: "new-form", label: "Neues Formular", group: "Aktionen", icon: <Plus />, keywords: "erstellen anlegen", run: () => create() }] : []),
      { id: "go-forms", label: "Formulare", group: "Gehe zu", icon: <FileStack />, run: () => router.push("/") },
      { id: "go-approvals", label: "Freigaben", group: "Gehe zu", icon: <CheckCheck />, run: () => router.push("/freigaben") },
      { id: "go-templates", label: "Vorlagen", group: "Gehe zu", icon: <LayoutTemplate />, run: () => router.push("/vorlagen") },
      { id: "go-settings", label: "Einstellungen", group: "Gehe zu", icon: <Settings />, run: () => router.push("/einstellungen") },
      { id: "go-account", label: "Mein Konto und Sicherheit", group: "Gehe zu", icon: <UserRound />, keywords: "passwort zwei faktor totp", run: () => router.push("/einstellungen/konto") },
      { id: "theme-light", label: "Helles Design", group: "Darstellung", icon: <Sun />, run: () => applyTheme("light") },
      { id: "theme-dark", label: "Dunkles Design", group: "Darstellung", icon: <Moon />, run: () => applyTheme("dark") },
      { id: "logout", label: "Abmelden", group: "Konto", icon: <LogOut />, run: () => logout() },
    ],
    [router, create, canCreate],
  );

  return (
    <TooltipProvider>
      <CommandProvider base={base} forms={forms}>
        <div className={cn("min-h-dvh", !fullscreen && "md:grid md:grid-cols-[232px_minmax(0,1fr)]")}>
          {!fullscreen && <Sidebar path={path} user={user} workspace={workspace} role={role} pendingApprovals={pendingApprovals} />}
          <main id="inhalt" className="min-w-0">{children}</main>
        </div>
        <Toaster position="bottom-right" visibleToasts={3} toastOptions={{
            duration: 3200,
            // Dunkle Fläche (ink) mit hellem Text; Knöpfe und Beschreibung mit ≥ 4,5:1
            classNames: {
              toast: "!rounded-md !border-0 !bg-ink !text-paper !shadow-pop !text-[13.5px] !w-[min(380px,calc(100vw-32px))] !items-start !gap-2.5",
              title: "!font-medium !leading-snug",
              description: "!text-paper !opacity-80 !text-[12.5px] !leading-snug",
              actionButton: "!h-7 !rounded-sm !bg-stamp !px-2.5 !text-[12.5px] !font-medium !text-stamp-ink",
              cancelButton: "!h-7 !rounded-sm !bg-transparent !px-2.5 !text-[12.5px] !text-paper !ring-1 !ring-paper/40",
            },
          }} />
      </CommandProvider>
    </TooltipProvider>
  );
}

function Sidebar({ path, user, workspace, role, pendingApprovals }: { path: string; user: { name: string; email: string }; workspace: string; role: Role; pendingApprovals: number }) {
  const openPalette = useOpenPalette();
  return (
    <aside className="sticky top-0 z-30 flex border-b border-line bg-desk md:h-dvh md:flex-col md:border-b-0 md:border-r md:px-3 md:py-4">
      <div className="flex items-center gap-2 px-3 py-2 md:mb-5 md:px-1 md:py-0">
        <WorkspaceSwitcher workspace={workspace} roleLabel={ROLE_LABELS[role].name} logo={<LogoMark />} />
      </div>
      <button onClick={openPalette} className="mb-4 hidden h-8 items-center gap-2 rounded-md border border-line bg-paper px-2.5 text-[13px] text-faint hover:border-line-strong md:flex">
        Suchen und Befehle
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>
      <nav aria-label="Hauptnavigation" className="flex flex-1 items-center gap-0.5 overflow-x-auto max-md:pr-2 md:flex-col md:items-stretch">
        {NAV.map((n) => {
          const active = n.match(path);
          return (
            <Link key={n.href} href={n.href} aria-label={n.label} aria-current={active ? "page" : undefined} className={cn("relative flex h-12 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[13.5px] md:h-8 md:flex-row md:justify-start md:gap-2.5 md:px-2.5 transition-colors [&_svg]:size-4", active ? "bg-paper font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-ink-2 hover:bg-desk-2")}>
              <n.icon className={active ? "text-stamp" : "text-muted"} />
              <span className="max-md:text-[10.5px] max-md:leading-none max-[359px]:sr-only">{n.label}</span>
              {n.href === "/freigaben" && pendingApprovals > 0 && <span className="ml-auto rounded-full bg-stamp px-1.5 max-md:absolute max-md:right-0 max-md:top-0.5 text-[11px] font-semibold text-stamp-ink tabular">{pendingApprovals}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center px-2 max-md:pr-3 md:block md:space-y-3">
        <div className="max-md:hidden">
          <ThemeSwitch />
        </div>
        <Menu>
          <MenuTrigger className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-desk-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-stamp-soft text-[12px] font-semibold text-stamp">{user.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 max-md:hidden">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11.5px] text-muted">{user.email}</span>
            </span>
          </MenuTrigger>
          <MenuContent align="start" side="top" className="w-56">
            <MenuLabel>{user.email}</MenuLabel>
            <MenuItem asChild>
              <Link href="/einstellungen/konto">
                <UserRound /> Konto und Sicherheit
              </Link>
            </MenuItem>
            <MenuItem asChild>
              <Link href="/einstellungen/team">
                <FileText /> Team
              </Link>
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => logout()}>
              <LogOut /> Abmelden
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </aside>
  );
}
