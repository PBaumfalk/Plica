"use client";
import { TimeAgo } from "@/components/ui/time-ago";
import { Check, Copy, Eye, KeyRound, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/controls";
import { FormRow, Input } from "@/components/ui/input";
import { Badge, Empty } from "@/components/ui/misc";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { cn } from "@/lib/cn";

import { createApiTokenAction, revealWebhookSecretAction, revokeApiTokenAction, rotateWebhookSecretAction } from "@/server/actions/api-tokens";

type Token = { id: string; name: string; prefix: string; scope: "read" | "write"; owner: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null };

function CopyButton({ text, label = "Kopieren" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />} {done ? "Kopiert" : label}
    </Button>
  );
}

const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// rawBody: unveränderter Request-Body als String
export function verifyPlica(rawBody, header, secret) {
  const p = Object.fromEntries(header.split(",").map((x) => x.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(p.t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(\`\${p.t}.\${rawBody}\`).digest("hex");
  return expected.length === p.v1?.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(p.v1));
}`;

export function ApiSettings({ tokens, baseUrl }: { tokens: Token[]; baseUrl: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [expiry, setExpiry] = useState("365");
  const [created, setCreated] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [revoke, setRevoke] = useState<Token | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const active = tokens.filter((t) => !t.revokedAt);
  const revoked = tokens.filter((t) => t.revokedAt);

  return (
    <div className="space-y-10">
      <section aria-labelledby="api-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="api-h" className="text-[16px] font-semibold">API-Schlüssel</h2>
            <p className="mt-1 max-w-xl text-[13.5px] text-muted">
              Für Eigenentwicklungen und Systeme wie CRM oder Fachsoftware. Ein Schlüssel kann nie mehr, als die Rolle seines Besitzers erlaubt. Dokumentation: <a className="font-mono text-[12.5px] text-stamp hover:underline" href="/api/v1/openapi.json" target="_blank" rel="noopener">openapi.json</a>
            </p>
          </div>
          <Button variant="primary" onClick={() => (setCreating(true), setName(""), setError(null), setCreated(null))}><Plus /> Neuer Schlüssel</Button>
        </div>
        {active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-paper/50">
            <Empty icon={<KeyRound />} title="Noch keine API-Schlüssel">Lege einen Schlüssel an, um Antworten automatisiert abzurufen oder Status zu setzen.</Empty>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-lg bg-paper shadow-sheet">
            {active.map((t) => {
              const expired = t.expiresAt && new Date(t.expiresAt) < new Date();
              return (
                <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-5 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      {t.name}
                      <Badge tone={t.scope === "write" ? "stamp" : "neutral"}>{t.scope === "write" ? "Lesen und schreiben" : "Nur lesen"}</Badge>
                      {expired && <Badge tone="bad">Abgelaufen</Badge>}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      <span className="font-mono">{t.prefix}…</span> · {t.owner} · {t.lastUsedAt ? <TimeAgo at={t.lastUsedAt} prefix="zuletzt genutzt " /> : "noch nie genutzt"}
                      {t.expiresAt && !expired && ` · läuft ab am ${new Date(t.expiresAt).toLocaleDateString("de-DE")}`}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-bad" onClick={() => setRevoke(t)}>Widerrufen</Button>
                </li>
              );
            })}
          </ul>
        )}
        {revoked.length > 0 && <p className="mt-2 text-[12.5px] text-faint">{revoked.length} widerrufene Schlüssel werden nicht angezeigt.</p>}
        <div className="mt-4 rounded-md border border-line bg-paper-2 px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-muted">Beispiel</div>
          <code className="block overflow-x-auto font-mono text-[12px] whitespace-pre text-ink-2">{`curl -H "Authorization: Bearer plc_…" \\\n  ${baseUrl}/forms`}</code>
        </div>
      </section>

      <section aria-labelledby="wh-h">
        <h2 id="wh-h" className="text-[16px] font-semibold">Webhook-Signatur</h2>
        <p className="mt-1 max-w-xl text-[13.5px] text-muted">
          Jeder Webhook trägt den Header <code className="font-mono text-[12.5px]">X-Plica-Signature</code>. Prüfe ihn mit diesem Geheimnis, bevor du Daten übernimmst. Bei Wiederholungen bleibt <code className="font-mono text-[12.5px]">X-Plica-Delivery</code> gleich.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-paper px-4 py-3 shadow-sheet">
          <code className={cn("min-w-0 flex-1 truncate font-mono text-[13px]", !secret && "text-faint")}>{secret ?? "••••••••••••••••••••••••••••••••"}</code>
          {secret ? (
            <CopyButton text={secret} />
          ) : (
            <Button size="sm" onClick={() => start(async () => {
              const r = await revealWebhookSecretAction();
              if (!r.ok) return void toast.error(r.error);
              setSecret(r.data.secret);
            })} loading={pending}><Eye /> Anzeigen</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setConfirmRotate(true)}><RefreshCw /> Neu erzeugen</Button>
        </div>
        <details className="mt-3 rounded-md border border-line bg-paper-2 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium">Signatur prüfen (Node.js)</summary>
          <pre className="mt-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-ink-2">{VERIFY_SNIPPET}</pre>
        </details>
      </section>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent title={created ? "Schlüssel angelegt" : "Neuer API-Schlüssel"} description={created ? "Kopiere den Schlüssel jetzt. Er wird nur dieses eine Mal angezeigt." : undefined}>
          {created ? (
            <div className="space-y-4">
              <code className="block rounded-md bg-desk px-3 py-2.5 font-mono text-[12.5px] break-all">{created}</code>
              <div className="flex justify-end gap-2">
                <CopyButton text={created} />
                <Button variant="primary" onClick={() => (setCreating(false), setCreated(null), router.refresh())}>Fertig</Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                start(async () => {
                  const r = await createApiTokenAction({ name, scope, expiresInDays: expiry === "never" ? null : Number(expiry) });
                  if (!r.ok) return setError(r.error);
                  setCreated(r.data.token);
                });
              }}
            >
              <FormRow label="Name" htmlFor="tok-name" hint="Wofür wird der Schlüssel genutzt?" error={error}>
                <Input id="tok-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. CRM-Anbindung" />
              </FormRow>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormRow label="Rechte">
                  <Select value={scope} onValueChange={(v) => setScope(v as "read" | "write")} options={[{ value: "read", label: "Nur lesen" }, { value: "write", label: "Lesen und schreiben" }]} />
                </FormRow>
                <FormRow label="Gültig">
                  <Select value={expiry} onValueChange={setExpiry} options={[{ value: "30", label: "30 Tage" }, { value: "90", label: "90 Tage" }, { value: "365", label: "1 Jahr" }, { value: "never", label: "Unbegrenzt" }]} />
                </FormRow>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" onClick={() => setCreating(false)}>Abbrechen</Button>
                <Button type="submit" variant="primary" loading={pending}>Anlegen</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
        <DialogContent title="Schlüssel widerrufen?" description={`„${revoke?.name}“ funktioniert sofort nicht mehr. Systeme, die ihn nutzen, erhalten den Fehler 401.`}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRevoke(null)}>Abbrechen</Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => {
              const r = await revokeApiTokenAction(revoke!.id);
              if (!r.ok) return void toast.error(r.error);
              toast("Schlüssel widerrufen");
              setRevoke(null);
              router.refresh();
            })}>Widerrufen</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <DialogContent title="Neues Webhook-Geheimnis erzeugen?" description="Das alte Geheimnis wird sofort ungültig. Alle Empfänger müssen das neue übernehmen, sonst lehnen sie Webhooks ab.">
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmRotate(false)}>Abbrechen</Button>
            <Button variant="danger" loading={pending} onClick={() => start(async () => {
              const r = await rotateWebhookSecretAction();
              if (!r.ok) return void toast.error(r.error);
              setSecret(r.data.secret);
              setConfirmRotate(false);
              toast("Neues Geheimnis erzeugt");
            })}>Neu erzeugen</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
