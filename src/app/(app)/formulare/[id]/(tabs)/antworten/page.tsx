import { requireViewer } from "@/server/auth/session";
import { ResponsesView } from "@/components/responses/responses-view";
import { loadResponses } from "./load";

export const metadata = { title: "Antworten" };

export default async function ResponsesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const v = await requireViewer("submissions.read");
  const data = await loadResponses(v, (await params).id, await searchParams);
  return <ResponsesView data={data} />;
}
