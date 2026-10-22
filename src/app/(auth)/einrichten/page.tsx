import { redirect } from "next/navigation";
import { needsSetup } from "@/server/setup";
import { SetupWizard } from "./setup-wizard";

export const metadata = { title: "Einrichten" };

export default async function SetupPage() {
  if (!(await needsSetup())) redirect("/login");
  return <SetupWizard />;
}
