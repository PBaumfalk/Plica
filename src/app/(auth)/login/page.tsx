import { redirect } from "next/navigation";
import { OIDC_ERROR_TEXT, type OidcErrorCode } from "@/server/auth/oidc";
import { getViewer } from "@/server/auth/session";
import { config } from "@/server/config";
import { needsSetup } from "@/server/setup";
import { LoginForm } from "./login-form";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await needsSetup()) redirect("/einrichten");
  const v = await getViewer();
  if (v && !v.mfaPending) redirect("/");
  const sp = await searchParams;
  const oidc = config().oidc;
  const code = typeof sp.fehler === "string" ? sp.fehler : "";
  const ssoError = Object.hasOwn(OIDC_ERROR_TEXT, code) ? OIDC_ERROR_TEXT[code as OidcErrorCode] : null;
  // Mit SSO kann die Passwort-Anmeldung ausgeblendet werden; sie bleibt über ?lokal=1 als Notzugang erreichbar.
  const showLocal = !oidc || config().LOCAL_LOGIN === "visible" || sp.lokal === "1";
  return <LoginForm sso={oidc ? { name: oidc.name } : null} showLocal={showLocal} ssoError={ssoError} />;
}
