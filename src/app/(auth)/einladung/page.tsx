import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/session";
import { NoWorkspace } from "./no-workspace";

export const metadata = { title: "Kein Workspace" };

export default async function NoWorkspacePage() {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.mfaPending) redirect("/login/zwei-faktor");
  if (v.workspace) redirect("/");
  return <NoWorkspace name={v.user.name} />;
}
