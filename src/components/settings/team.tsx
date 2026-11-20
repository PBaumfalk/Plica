"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Copy, Crown, Link2, Mail, MoreHorizontal, ShieldCheck, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/controls";
import { FormRow, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { greetingName } from "@/lib/names";
import { Dialog, DialogContent, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip } from "@/components/ui/overlays";

import { changeRoleAction, inviteMemberAction, leaveWorkspaceAction, removeMemberAction, revokeInvitationAction, transferOwnershipAction } from "@/server/actions/team";
import { ROLE_LABELS } from "@/server/auth/rbac";
import type { Role } from "@/server/db/schema";
import { useAction } from "./use-action";

type Member = { userId: string; name: string; email: string; role: Role; totp: boolean; lastLoginAt: string | null; manageable: boolean; assignable: Role[] };

const roleOptions = (roles: Role[]) => roles.map((r) => ({ value: r, label: ROLE_LABELS[r].name }));

export function MembersList({ members, me, myRole }: { members: Member[]; me: string; myRole: Role }) {
  const router = useRouter();
  const a = useAction();
  const [confirm, setConfirm] = useState<{ kind: "remove" | "transfer"; m: Member } | null>(null);
  return (
    <>
      <ul className="divide-y divide-line rounded-md border border-line">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-stamp-soft text-[12.5px] font-semibold text-stamp">{greetingName(m.name).slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <span className="truncate">{m.name}</span>
                {m.userId === me && <Badge>Du</Badge>}
                {m.totp && <Tip label="Zwei-Faktor-Anmeldung aktiv"><ShieldCheck className="size-3.5 text-ok" aria-label="Zwei-Faktor aktiv" /></Tip>}
              </div>
              <div className="truncate text-[12.5px] text-muted">{m.email}{m.lastLoginAt ? <TimeAgo at={m.lastLoginAt} prefix=" · zuletzt aktiv " /> : " · noch nie angemeldet"}</div>
            </div>
            <div className="flex items-center gap-1">
              {m.manageable ? (
                <div className="w-40">
                  <Select
                    label={`Rolle von ${m.name}`}
                    value={m.role}
                    options={roleOptions(m.role === "owner" ? ["owner", ...m.assignable] : m.assignable)}
                    onValueChange={(r) => a.run(() => changeRoleAction(m.userId, r), () => { toast(`${m.name} ist jetzt ${ROLE_LABELS[r as Role].name}`); router.refresh(); })}
                    className="h-8 text-[13px]"
                  />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-2">{m.role === "owner" && <Crown className="size-3.5 text-warn" />}{ROLE_LABELS[m.role].name}</span>
              )}
              {(m.manageable || (myRole === "owner" && m.userId !== me)) && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Aktionen für ${m.name}`}><MoreHorizontal /></Button>
                  </MenuTrigger>
                  <MenuContent>
                    {myRole === "owner" && m.userId !== me && m.role !== "owner" && <MenuItem onSelect={() => setConfirm({ kind: "transfer", m })}><Crown /> Inhaberschaft übertragen …</MenuItem>}
                    {m.manageable && (
                      <>
                        {myRole === "owner" && m.role !== "owner" && <MenuSeparator />}
                        <MenuItem danger onSelect={() => setConfirm({ kind: "remove", m })}><UserMinus /> Aus dem Workspace entfernen …</MenuItem>
                      </>
                    )}
                  </MenuContent>
                </Menu>
              )}
            </div>
          </li>
        ))}
      </ul>
      {a.error && <p role="alert" className="mt-3 text-[13px] text-bad">{a.error}</p>}
      <details className="mt-4 text-[13px] text-muted">
        <summary className="cursor-pointer select-none hover:text-ink">Was dürfen die Rollen?</summary>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr]">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <div key={r} className="contents">
              <dt className="font-medium text-ink-2">{ROLE_LABELS[r].name}</dt>
              <dd>{ROLE_LABELS[r].description}</dd>
            </div>
          ))}
        </dl>
      </details>
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent
            title={confirm.kind === "remove" ? `${confirm.m.name} entfernen?` : `Inhaberschaft an ${confirm.m.name} übertragen?`}
            description={confirm.kind === "remove" ? "Die Person verliert sofort den Zugriff auf alle Formulare und Antworten dieses Workspace. Ihr Konto bleibt bestehen." : "Die Person wird Inhaber. Du wirst Administrator und kannst den Workspace danach nicht mehr löschen."}
          >
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirm(null)}>Abbrechen</Button>
              <Button
                variant={confirm.kind === "remove" ? "danger" : "primary"}
                loading={a.pending}
                onClick={() => {
                  const c = confirm;
                  a.run(() => (c.kind === "remove" ? removeMemberAction(c.m.userId) : transferOwnershipAction(c.m.userId)), () => {
                    setConfirm(null);
                    toast(c.kind === "remove" ? `${c.m.name} wurde entfernt` : `${c.m.name} ist jetzt Inhaber`);
                    router.refresh();
                  });
                }}
              >
                {confirm.kind === "remove" ? "Entfernen" : "Übertragen"}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

export function InviteForm({ roles, mail }: { roles: Role[]; mail: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(roles.includes("editor") ? "editor" : roles[0]);
  const [send, setSend] = useState(mail);
  const [result, setResult] = useState<{ link: string; emailed: boolean; emailError?: string; email: string } | null>(null);
  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(() => inviteMemberAction({ email, role, sendEmail: send }), (d) => {
            setResult({ ...d, email });
            setEmail("");
            router.refresh();
          });
        }}
      >
        <FormRow label="E-Mail-Adresse" htmlFor="inv-email" error={a.fieldErrors.email}>
          <Input id="inv-email" type="email" placeholder="name@firma.de" value={email} onChange={(e) => setEmail(e.target.value)} required aria-invalid={!!a.fieldErrors.email} />
        </FormRow>
        <FormRow label="Rolle" htmlFor="inv-role" error={a.fieldErrors.role}>
          <Select id="inv-role" label="Rolle" value={role} onValueChange={(r) => setRole(r as Role)} options={roleOptions(roles)} />
        </FormRow>
        <Button type="submit" variant="primary" className="h-9" loading={a.pending}>Einladen</Button>
      </form>
      <label className="flex items-center gap-2 text-[13.5px] text-ink-2">
        <Checkbox checked={send && mail} onCheckedChange={setSend} label="Einladung per E-Mail senden" />
        <span className={mail ? "" : "text-faint"}>Einladung per E-Mail senden{!mail && " (E-Mail-Versand ist nicht eingerichtet)"}</span>
      </label>
      <p className="text-[12.5px] text-muted"><span className="font-medium text-ink-2">{ROLE_LABELS[role]?.name}:</span> {ROLE_LABELS[role]?.description}</p>
      {a.error && !Object.keys(a.fieldErrors).length && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
      {result && (
        <div className="rounded-md border border-stamp-line bg-stamp-soft p-4 animate-pop-in" role="status">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-medium">
            {result.emailed ? <Mail className="size-4 text-stamp" /> : <Link2 className="size-4 text-stamp" />}
            {result.emailed ? `Einladung an ${result.email} gesendet.` : `Einladung für ${result.email} erstellt.`}
          </div>
          {result.emailError && <p className="mb-2 text-[13px] text-warn">{result.emailError}</p>}
          <div className="flex gap-2">
            <Input readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} aria-label="Einladungslink" className="font-mono text-[12.5px]" />
            <Button onClick={() => navigator.clipboard.writeText(result.link).then(() => toast("Link kopiert"))}><Copy /> Kopieren</Button>
          </div>
          <p className="mt-2 text-[12.5px] text-muted">Der Link wird nur jetzt angezeigt. Wer ihn hat, kann der Einladung folgen – teile ihn nur mit dieser Person.</p>
        </div>
      )}
    </div>
  );
}

export function InvitationsList({ invitations }: { invitations: { id: string; email: string; role: Role; expiresAt: string; invitedBy: string | null }[] }) {
  const router = useRouter();
  const a = useAction();
  return (
    <ul className="divide-y divide-line rounded-md border border-line">
      {invitations.map((i) => (
        <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px]">{i.email}</div>
            <div className="text-[12.5px] text-muted">{ROLE_LABELS[i.role].name} · läuft ab {new Date(i.expiresAt).toLocaleDateString("de-DE", { day: "numeric", month: "long" })}{i.invitedBy ? ` · von ${i.invitedBy}` : ""}</div>
          </div>
          <Button size="sm" variant="ghost" disabled={a.pending} onClick={() => a.run(() => revokeInvitationAction(i.id), () => { toast("Einladung zurückgezogen"); router.refresh(); })}>Zurückziehen</Button>
        </li>
      ))}
      {a.error && <li role="alert" className="px-4 py-2 text-[13px] text-bad">{a.error}</li>}
    </ul>
  );
}

export function LeaveWorkspace({ workspace }: { workspace: string }) {
  const router = useRouter();
  const a = useAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Workspace verlassen …</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`„${workspace}“ verlassen?`} description="Um wieder Zugriff zu bekommen, brauchst du eine neue Einladung.">
          {a.error && <p role="alert" className="mb-3 text-[13px] text-bad">{a.error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Abbrechen</Button>
            <Button variant="danger" loading={a.pending} onClick={() => a.run(() => leaveWorkspaceAction(), () => { router.push("/"); router.refresh(); })}>Verlassen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
