import { requireViewer } from "@/server/auth/session";
import { getForm, getPublishedVersion } from "@/server/forms/service";
import { formAnalytics } from "@/server/analytics/service";
import { AnalyticsView } from "@/components/share/analytics-view";

export const metadata = { title: "Auswertung" };

const RANGES = [7, 30, 90, 365];

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tage?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.tage)) ? Number(sp.tage) : 30;
  const v = await requireViewer("submissions.read");
  const form = await getForm(v.workspace.id, id);
  const version = await getPublishedVersion(form.id, form.publishedVersionId);
  const def = version?.definition ?? form.draft;
  const data = await formAnalytics(v.workspace.id, form.id, def, days);
  return <AnalyticsView formId={form.id} data={data} published={!!version} versionNumber={version?.number ?? null} />;
}
