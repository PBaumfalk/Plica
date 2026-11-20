import { ScrollText } from "lucide-react";
import Link from "next/link";
import { requireViewer } from "@/server/auth/session";
import { auditActions, listAudit } from "@/server/workspaces/workspace";
import { listMembers } from "@/server/workspaces/team";
import { auditDetail, auditLabel } from "@/components/settings/audit-labels";
import { Empty } from "@/components/ui/misc";
import { fieldBase } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata = { title: "Protokoll" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function AuditPage({ searchParams }: { searchParams: SP }) {
  const v = await requireViewer("audit.read");
  const sp = await searchParams;
  const filters = { action: str(sp.aktion), userId: str(sp.person), from: str(sp.von), to: str(sp.bis), page: Number(str(sp.seite) ?? "1") || 1 };
  const [{ rows, hasMore, page }, actions, members] = await Promise.all([listAudit(v.workspace.id, filters), auditActions(v.workspace.id), listMembers(v.workspace.id)]);
  const qs = (p: number) => {
    const q = new URLSearchParams();
    if (filters.action) q.set("aktion", filters.action);
    if (filters.userId) q.set("person", filters.userId);
    if (filters.from) q.set("von", filters.from);
    if (filters.to) q.set("bis", filters.to);
    if (p > 1) q.set("seite", String(p));
    const s = q.toString();
    return `/einstellungen/protokoll${s ? `?${s}` : ""}`;
  };
  const active = !!(filters.action || filters.userId || filters.from || filters.to);
  const sel = cn(fieldBase, "h-8 text-[13px]");
  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg bg-paper p-3 shadow-sheet">
        <label className="grid gap-1 text-[12px] text-muted">
          Aktion
          <select name="aktion" defaultValue={filters.action ?? ""} className={cn(sel, "w-56")}>
            <option value="">Alle</option>
            {actions.map((a) => <option key={a} value={a}>{auditLabel(a)}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] text-muted">
          Person
          <select name="person" defaultValue={filters.userId ?? ""} className={cn(sel, "w-44")}>
            <option value="">Alle</option>
            {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[12px] text-muted">
          Von
          <input type="date" name="von" defaultValue={filters.from} className={cn(sel, "w-36")} />
        </label>
        <label className="grid gap-1 text-[12px] text-muted">
          Bis
          <input type="date" name="bis" defaultValue={filters.to} className={cn(sel, "w-36")} />
        </label>
        <Button type="submit" size="sm" className="h-8">Filtern</Button>
        {active && <Link href="/einstellungen/protokoll" className="h-8 px-2 text-[13px] leading-8 text-muted hover:text-ink">Zurücksetzen</Link>}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg bg-paper shadow-sheet">
          <Empty icon={<ScrollText />} title={active ? "Keine Einträge für diese Filter" : "Noch keine Einträge"}>
            {active ? "Passe die Filter an oder setze sie zurück." : "Hier erscheinen Änderungen an Formularen, Antworten, Rollen und Einstellungen dieses Workspace."}
          </Empty>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-paper shadow-sheet">
          <table className="w-full text-[13.5px]">
            <caption className="sr-only">Protokoll</caption>
            <thead className="border-b border-line bg-paper-2 text-left text-[12px] text-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Zeitpunkt</th>
                <th scope="col" className="px-4 py-2 font-medium">Person</th>
                <th scope="col" className="px-4 py-2 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const detail = auditDetail(r.action, r.meta ?? {});
                return (
                  <tr key={r.id} className="border-b border-line align-middle last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-muted tabular">{r.createdAt.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Berlin" })}</td>
                    <td className="px-4 py-2.5">{r.userName ?? <span className="text-faint">System</span>}</td>
                    <td className="px-4 py-2.5">
                      {auditLabel(r.action)}
                      {detail && <span className="text-muted"> · {detail}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(page > 1 || hasMore) && (
        <nav aria-label="Seiten" className="flex items-center justify-between text-[13px]">
          {page > 1 ? <Link href={qs(page - 1)} className="text-stamp hover:underline">← Neuere</Link> : <span />}
          <span className="text-muted">Seite {page}</span>
          {hasMore ? <Link href={qs(page + 1)} className="text-stamp hover:underline">Ältere →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
