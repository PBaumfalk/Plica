import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth/session";
import { NotFound } from "@/server/forms/service";
import { parseListQuery } from "@/server/submissions/service";
import { ResponseSplit } from "@/components/responses/response-split";
import { loadResponses } from "../load";
import { loadDetail } from "./detail-loader";

export const metadata = { title: "Antwort" };

export default async function ResponseDetailPage({ params, searchParams }: { params: Promise<{ id: string; sid: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id, sid } = await params;
  const sp = await searchParams;
  const v = await requireViewer("submissions.read");
  const data = await loadResponses(v, id, sp);
  const detail = await loadDetail(v.workspace.id, v.user.id, id, sid, parseListQuery(sp)).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  return <ResponseSplit data={data} detail={detail} />;
}
