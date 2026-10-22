"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Laptop, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { dateTime } from "@/lib/time";
import { revokeOtherSessionsAction, revokeSessionAction } from "@/server/actions/settings";
import { useAction } from "./use-action";

export function SessionsList({ sessions, current }: { sessions: { id: string; device: string; createdAt: string; lastSeenAt: string }[]; current: string }) {
  const router = useRouter();
  const a = useAction();
  const others = sessions.filter((s) => s.id !== current).length;
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-md border border-line">
        {sessions.map((s) => {
          const mobile = /iOS|Android/.test(s.device);
          const Icon = mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[14px]">{s.device} {s.id === current && <Badge tone="stamp">Dieses Gerät</Badge>}</div>
                <div className="text-[12.5px] text-muted" title={`Angemeldet ${dateTime(s.createdAt)}`}>Zuletzt aktiv <TimeAgo at={s.lastSeenAt} /> · angemeldet {dateTime(s.createdAt)}</div>
              </div>
              {s.id !== current && (
                <Button size="sm" variant="ghost" disabled={a.pending} onClick={() => a.run(() => revokeSessionAction(s.id), () => { toast("Sitzung beendet"); router.refresh(); })}>Abmelden</Button>
              )}
            </li>
          );
        })}
      </ul>
      {a.error && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
      {others > 0 && (
        <Button variant="secondary" loading={a.pending} onClick={() => a.run(() => revokeOtherSessionsAction(), (d) => { toast(`${d.count} ${d.count === 1 ? "Sitzung" : "Sitzungen"} beendet`); router.refresh(); })}>
          Alle anderen Geräte abmelden
        </Button>
      )}
    </div>
  );
}
