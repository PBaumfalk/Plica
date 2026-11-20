"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormRow, Input } from "@/components/ui/input";
import { logout } from "@/server/actions/auth";
import { createWorkspaceAction } from "@/server/actions/settings";
import { useAction } from "@/components/settings/use-action";

export function NoWorkspace({ name, canCreate }: { name: string; canCreate: boolean }) {
  const router = useRouter();
  const a = useAction();
  const [ws, setWs] = useState("");
  return (
    <div className="rounded-lg bg-paper p-7 shadow-sheet">
      <h1 className="font-display text-[26px] leading-tight font-[450]">Hallo {name}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {canCreate
          ? "Du gehörst gerade zu keinem Workspace. Öffne den Einladungslink, den du bekommen hast – oder lege einen eigenen Workspace an."
          : "Du gehörst gerade zu keinem Workspace. Öffne den Einladungslink, den du bekommen hast, oder bitte eine Administratorin oder einen Administrator deiner Organisation um eine Einladung."}
      </p>
      {!canCreate && <button type="button" onClick={() => logout()} className="mt-6 w-full text-center text-[13px] text-muted hover:text-ink">Abmelden</button>}
      {canCreate && <form className="mt-6 space-y-4" onSubmit={(e) => {
        e.preventDefault();
        a.run(() => createWorkspaceAction(ws), () => { router.replace("/"); router.refresh(); });
      }}>
        <FormRow label="Name des Workspace" htmlFor="ws" error={a.fieldErrors.name ?? a.error}>
          <Input id="ws" placeholder="z. B. Musterfirma GmbH" value={ws} onChange={(e) => setWs(e.target.value)} />
        </FormRow>
        <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={a.pending} disabled={!ws.trim()}>Workspace anlegen</Button>
        <button type="button" onClick={() => logout()} className="w-full text-center text-[13px] text-muted hover:text-ink">Abmelden</button>
      </form>}
    </div>
  );
}
