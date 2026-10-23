import { requireViewer } from "@/server/auth/session";
import { getWorkspace, listMyWorkspaces } from "@/server/workspaces/workspace";
import { Section, Stack } from "@/components/settings/section";
import { CreateWorkspace, DeleteWorkspace, WorkspaceForm } from "@/components/settings/workspace";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { ROLE_LABELS } from "@/server/auth/rbac";

export const metadata = { title: "Workspace" };

export default async function WorkspacePage() {
  const v = await requireViewer("workspace.manage");
  const [ws, mine] = await Promise.all([getWorkspace(v.workspace.id), listMyWorkspaces(v.user.id)]);
  return (
    <Stack>
      <Section id="allgemein" title="Allgemein" description="Der Name erscheint in der Seitenleiste und in Einladungen.">
        <WorkspaceForm name={ws?.name ?? ""} retentionDays={ws?.retentionDays ?? null} />
      </Section>
      <Section id="export" title="Daten exportieren" description="Eine JSON-Datei mit allen Formularen, Versionen, Antworten, Notizen und dem Bearbeitungsverlauf. Dateiinhalte sind nicht enthalten; sie lassen sich je Antwort herunterladen. Der Export wird protokolliert.">
        <Button asChild variant="secondary">
          <a href="/einstellungen/workspace/export" download><Download /> Export herunterladen</a>
        </Button>
      </Section>
      <Section id="workspaces" title="Deine Workspaces" description="Workspaces trennen Formulare, Antworten und Teams vollständig voneinander – etwa für Kanzlei und Verein.">
        <ul className="mb-4 divide-y divide-line rounded-md border border-line">
          {mine.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
              <span className="truncate">{w.name}{w.id === v.workspace.id && <span className="ml-2 text-[12.5px] text-muted">aktuell</span>}</span>
              <span className="text-[12.5px] text-muted">{ROLE_LABELS[w.role].name}</span>
            </li>
          ))}
        </ul>
        {v.user.isInstanceAdmin ? <CreateWorkspace /> : <p className="text-[13px] text-muted">Neue Workspaces legt der Inhaber der Installation an.</p>}
      </Section>
      {v.role === "owner" && (
        <Section id="loeschen" tone="danger" title="Workspace löschen" description="Löscht alle Formulare, Antworten, Dateien und Automationen dieses Workspace endgültig. Das lässt sich nicht rückgängig machen – exportiere vorher, was du behalten willst.">
          <DeleteWorkspace name={ws?.name ?? ""} only={mine.length <= 1} />
        </Section>
      )}
    </Stack>
  );
}
