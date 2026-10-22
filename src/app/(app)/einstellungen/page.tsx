import { ChevronRight, KeyRound, ScrollText, Settings2, Users, Webhook } from "lucide-react";
import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { can, ROLE_LABELS } from "@/server/auth/rbac";

export const metadata = { title: "Einstellungen" };

export default async function SettingsOverview() {
  const v = await requireViewer();
  const rows = [
    { href: "/einstellungen/konto", icon: KeyRound, title: "Konto und Sicherheit", text: v.user.totpEnabled ? "Profil, Passwort, Sitzungen · Zwei-Faktor aktiv" : "Profil, Passwort, Sitzungen · Zwei-Faktor empfohlen", warn: !v.user.totpEnabled },
    { href: "/einstellungen/team", icon: Users, title: "Team", text: `Du bist ${ROLE_LABELS[v.role].name}. Mitglieder, Rollen und Einladungen.` },
    ...(can(v.role, "workspace.manage") ? [{ href: "/einstellungen/workspace", icon: Settings2, title: "Workspace", text: "Name, Aufbewahrung, Export und weitere Workspaces." }] : []),
    ...(can(v.role, "audit.read") ? [{ href: "/einstellungen/protokoll", icon: ScrollText, title: "Protokoll", text: "Wer hat wann was geändert – nachvollziehbar und ohne Inhalte." }] : []),
    ...(can(v.role, "tokens.manage") ? [{ href: "/einstellungen/api", icon: Webhook, title: "API und Webhooks", text: "Zugangsschlüssel für Integrationen und das Webhook-Geheimnis." }] : []),
  ];
  return (
    <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
      {rows.map((r) => (
        <li key={r.href} className="border-b border-line last:border-b-0">
          <Link href={r.href} className="flex items-center gap-4 px-5 py-4 hover:bg-paper-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-desk text-muted"><r.icon className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium">{r.title}</span>
              <span className={"block text-[13px] " + ("warn" in r && r.warn ? "text-warn" : "text-muted")}>{r.text}</span>
            </span>
            <ChevronRight className="size-4 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
