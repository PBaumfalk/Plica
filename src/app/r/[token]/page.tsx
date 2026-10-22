import { notFound } from "next/navigation";
import { issueFormToken } from "@/server/submissions/submit";
import { shortId } from "@/server/lib/crypto";
import { loadResume } from "@/server/resume/service";
import { PublicForm } from "@/app/f/[slug]/public-form";

export const metadata = { title: "Formular fortsetzen", robots: { index: false, follow: false } };

export default async function ResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await loadResume(token);
  if (!r) {
    return (
      <main className="min-h-dvh sm:px-4 sm:py-12">
        <div className="mx-auto max-w-[720px] bg-paper px-5 py-16 text-center shadow-sheet sm:rounded-lg sm:px-12">
          <h1 className="font-display text-[28px] font-[450]">Dieser Link ist nicht mehr gültig</h1>
          <p className="mx-auto mt-3 max-w-md text-[16px] text-muted">Fortsetzungslinks gelten 30 Tage und nur bis zum Absenden. Bitte öffnen Sie das Formular neu.</p>
        </div>
      </main>
    );
  }
  const { loaded } = r;
  if (loaded.closed) notFound();
  return (
    <main className="min-h-dvh sm:px-4 sm:py-12">
      <div className="mx-auto min-h-dvh max-w-[720px] bg-paper px-5 py-10 shadow-sheet sm:min-h-0 sm:rounded-lg sm:px-12 sm:py-14">
        <p className="mb-6 rounded-md bg-paper-2 px-3 py-2 text-[13px] text-muted" role="status">Willkommen zurück – Ihre bisherigen Angaben sind wiederhergestellt.</p>
        <PublicForm
          slug={loaded.form.slug}
          definition={loaded.definition}
          token={issueFormToken(loaded.form.id, r.uploadSession ?? shortId(24), r.startedAt)}
          initialAnswers={r.answers}
          initialPageId={r.pageId}
          resumeToken={token}
          embedded={false}
        />
      </div>
    </main>
  );
}
