import { requireViewer } from "@/server/auth/session";
import { listSessions } from "@/server/workspaces/account";
import { Section, Stack } from "@/components/settings/section";
import { PasswordForm, ProfileForm } from "@/components/settings/account-forms";
import { TwoFactor } from "@/components/settings/two-factor";
import { SessionsList } from "@/components/settings/sessions-list";

export const metadata = { title: "Konto" };

export default async function AccountPage() {
  const v = await requireViewer();
  const sessions = await listSessions(v.user.id);
  return (
    <Stack>
      <Section id="profil" title="Profil" description="Dein Name erscheint in Notizen, im Verlauf von Antworten und im Protokoll.">
        <ProfileForm name={v.user.name} email={v.user.email} />
      </Section>
      <Section id="passwort" title="Passwort" description="Nach der Änderung werden alle anderen Sitzungen beendet.">
        <PasswordForm />
      </Section>
      <Section id="zwei-faktor" title="Zwei-Faktor-Anmeldung" description="Zusätzlich zum Passwort fragt PLICA nach einem Code aus einer Authenticator-App (z. B. 1Password, Aegis, Google Authenticator).">
        <TwoFactor enabled={v.user.totpEnabled} />
      </Section>
      <Section id="sitzungen" title="Angemeldete Geräte" description="Beende Sitzungen, die du nicht wiedererkennst.">
        <SessionsList
          current={v.sessionId.slice(0, 12)}
          sessions={sessions.map((s) => ({ id: s.id.slice(0, 12), device: s.device ?? "Unbekannt", createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))}
        />
      </Section>
    </Stack>
  );
}
