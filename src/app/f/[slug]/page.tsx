import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fieldIndex } from "@/lib/forms/schema";
import { shortId, verifyPayload } from "@/server/lib/crypto";
import { resolvePrefill } from "@/server/prefill/service";
import { issueFormToken, loadPublicForm } from "@/server/submissions/submit";
import { PasswordGate } from "./password-gate";
import { PublicForm } from "./public-form";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await loadPublicForm((await params).slug);
  return { title: loaded?.definition.title ?? "Formular", robots: { index: false, follow: false } };
}

export default async function PublicFormPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const loaded = await loadPublicForm(slug);
  if (!loaded) notFound();
  const { form, definition } = loaded;
  const embedded = sp.embed === "1";

  const shell = (children: React.ReactNode) => (
    <main className={embedded ? "bg-paper px-5 py-8 sm:px-8" : "min-h-dvh px-0 py-0 sm:px-4 sm:py-12"}>
      <div className={embedded ? "mx-auto max-w-[680px]" : "mx-auto min-h-dvh max-w-[720px] bg-paper px-5 py-10 shadow-sheet sm:min-h-0 sm:rounded-lg sm:px-12 sm:py-14"}>{children}</div>
    </main>
  );

  if (loaded.closed) {
    return shell(
      <div className="py-12 text-center">
        <h1 className="font-display text-[28px] font-[450]">{definition.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-[16px] text-muted">{loaded.closed}</p>
      </div>,
    );
  }

  if (form.passwordHash) {
    const k = typeof sp.k === "string" ? sp.k : "";
    const unlocked = verifyPayload<{ f: string }>(k, "unlock");
    if (!unlocked || unlocked.f !== form.id) {
      return shell(<PasswordGate slug={slug} title={definition.title} embedded={embedded} prefill={typeof sp.prefill === "string" ? sp.prefill : undefined} icon={<Lock className="size-5" />} />);
    }
  }

  // Vorbefüllung: nur versteckte Felder mit freigegebenem URL-Parameter
  const initial: Record<string, unknown> = {};
  for (const { field, parent } of fieldIndex(definition).values()) {
    if (parent || field.type !== "hidden" || !field.urlParam) continue;
    const v = sp[field.urlParam];
    if (typeof v === "string") initial[field.id] = v.slice(0, 500);
  }

  // Folgeformular: signiertes Token → Werte aus der Quell-Antwort (gleicher Workspace)
  let prefillFrom: string | undefined;
  if (typeof sp.prefill === "string" && sp.prefill.length < 600) {
    const pre = await resolvePrefill(sp.prefill, { id: form.id, workspaceId: form.workspaceId, definition });
    if (pre) {
      Object.assign(initial, pre.answers);
      prefillFrom = pre.submissionId;
    }
  }

  const uploadSession = shortId(24);
  return shell(
    <PublicForm
      slug={slug}
      definition={definition}
      token={issueFormToken(form.id, uploadSession)}
      initialAnswers={initial}
      embedded={embedded}
      prefillFrom={prefillFrom}
    />,
  );
}
