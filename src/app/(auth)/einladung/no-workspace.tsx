"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { logout } from "@/server/actions/auth";
import { createWorkspaceAction } from "@/server/actions/settings";
import { useAction } from "@/components/settings/use-action";

export function NoWorkspace({ name }: { name: string }) {
  const router = useRouter();
  const a = useAction();
  const [ws, setWs] = useState("");
  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <h1 className="font-display text-[26px] leading-tight font-[450]">Hallo {name}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">Du gehörst gerade zu keinem Workspace. Öffne den Einladungslink, den du bekommen hast – oder lege einen eigenen Workspace an.</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => {
        e.preventDefault();
        a.run(() => createWorkspaceAction(ws), () => { router.replace("/"); router.refresh(); });
      }}>
        <FormRow label="Name des Workspace" htmlFor="ws" error={a.fieldErrors.name ?? a.error}>
          <Input id="ws" placeholder="z. B. Kanzlei Musterstadt" value={ws} onChange={(e) => setWs(e.target.value)} />
        </FormRow>
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={a.pending} disabled={!ws.trim()}>Workspace anlegen</Button>
        <button type="button" onClick={() => logout()} className="w-full text-center text-[13px] text-muted hover:text-ink">Abmelden</button>
      </form>
    </div>
  );
}
