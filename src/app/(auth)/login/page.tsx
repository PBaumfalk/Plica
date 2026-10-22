import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/session";
import { needsSetup } from "@/server/setup";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage() {
  if (await needsSetup()) redirect("/einrichten");
  const v = await getViewer();
  if (v && !v.mfaPending) redirect("/");
  return <LoginForm />;
}
