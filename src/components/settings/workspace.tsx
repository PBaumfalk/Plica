"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import { FormRow, Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { createWorkspaceAction, deleteWorkspaceAction, updateWorkspaceAction } from "@/server/actions/settings";
import { useAction } from "./use-action";

export function WorkspaceForm({ name, retentionDays }: { name: string; retentionDays: number | null }) {
  const router = useRouter();
  const a = useAction();
  const [n, setN] = useState(name);
  const [limit, setLimit] = useState(retentionDays !== null);
  const [days, setDays] = useState(String(retentionDays ?? 365));
  const dirty = n !== name || limit !== (retentionDays !== null) || (limit && Number(days) !== retentionDays);
  return (
    <form
      className="grid max-w-lg gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => updateWorkspaceAction({ name: n, retentionDays: limit ? Math.round(Number(days)) : null }), () => { toast("Workspace gespeichert"); router.refresh(); });
      }}
    >
      <FormRow label="Name" htmlFor="ws-name" error={a.fieldErrors.name}>
        <Input id="ws-name" value={n} onChange={(e) => setN(e.target.value)} required />
      </FormRow>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch id="ws-ret" checked={limit} onCheckedChange={setLimit} label="Antworten automatisch löschen" />
          <label htmlFor="ws-ret" className="text-[13.5px] font-medium text-ink-2">Antworten automatisch löschen</label>
        </div>
        {limit && (
          <FormRow label="Aufbewahrung in Tagen" htmlFor="ws-days" hint="Gilt für neue Antworten aller Formulare ohne eigene Frist. Die Löschung umfasst auch hochgeladene Dateien." error={a.fieldErrors.retentionDays}>
            <Input id="ws-days" type="number" inputMode="numeric" min={1} max={36500} value={days} onChange={(e) => setDays(e.target.value)} className="max-w-32 tabular" />
          </FormRow>
        )}
        {!limit && <p className="text-[12.5px] text-muted">Antworten bleiben gespeichert, bis jemand sie löscht. Prüfe, welche Fristen für deine Daten gelten.</p>}
      </div>
      {a.error && !Object.keys(a.fieldErrors).length && <p role="alert" className="text-[13px] text-bad">{a.error}</p>}
      <div>
        <Button type="submit" variant="primary" disabled={!dirty} loading={a.pending}>Speichern</Button>
      </div>
    </form>
  );
}

export function CreateWorkspace({ openInitially, onClosed }: { openInitially?: boolean; onClosed?: () => void }) {
  const router = useRouter();
  const a = useAction();
  const [open, setOpenState] = useState(!!openInitially);
  const setOpen = (o: boolean) => {
    setOpenState(o);
    if (!o) onClosed?.();
  };
  const [name, setName] = useState("");
  return (
    <>
      {!openInitially && <Button onClick={() => setOpen(true)}><Plus /> Neuer Workspace</Button>}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setName(""); }}>
        <DialogContent title="Neuer Workspace" description="Du wirst Inhaber und wechselst direkt hinein. Formulare und Antworten bleiben strikt getrennt.">
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            a.run(() => createWorkspaceAction(name), () => { setOpen(false); toast(`Workspace „${name}“ angelegt`); router.push("/"); router.refresh(); });
          }}>
            <FormRow label="Name" htmlFor="new-ws" error={a.fieldErrors.name ?? a.error}>
              <Input id="new-ws" autoFocus placeholder="z. B. Verein Musterstadt" value={name} onChange={(e) => setName(e.target.value)} />
            </FormRow>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button type="submit" variant="primary" loading={a.pending} disabled={!name.trim()}>Anlegen</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteWorkspace({ name, only }: { name: string; only: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  if (only) return <p className="text-[13.5px] text-muted">Das ist dein einziger Workspace. Lege zuerst einen weiteren an, um diesen löschen zu können.</p>;
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Workspace löschen …</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); setConfirm(""); }}>
        <DialogContent title="Endgültig löschen?" description={`Alle Formulare, Antworten und Dateien von „${name}“ werden gelöscht. Gib zur Bestätigung den Namen des Workspace ein.`}>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            a.run(() => deleteWorkspaceAction(confirm), (d) => {
              setOpen(false);
              toast(d.storageErrors ? `Workspace gelöscht. ${d.storageErrors} Dateien konnten nicht aus dem Speicher entfernt werden – siehe Server-Log.` : "Workspace gelöscht");
              router.push("/");
              router.refresh();
            });
          }}>
            <FormRow label={<>Name: <span className="font-mono">{name}</span></>} htmlFor="del-ws" error={a.fieldErrors.confirm ?? a.error}>
              <Input id="del-ws" autoFocus autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </FormRow>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button type="submit" variant="danger" loading={a.pending} disabled={confirm.trim() !== name}>Endgültig löschen</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
