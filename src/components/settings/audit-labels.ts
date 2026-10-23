/** Lesbare Bezeichnungen für Protokolleinträge. Unbekannte Aktionen erscheinen im Rohformat. */
export const AUDIT_LABELS: Record<string, string> = {
  "setup.complete": "PLICA eingerichtet",
  "login.success": "Angemeldet",
  "login.failed": "Anmeldung fehlgeschlagen",
  "login.sso_linked": "Konto mit SSO verknüpft",
  "login.sso_user_created": "Konto über SSO angelegt",
  "login.sso_failed": "SSO-Anmeldung fehlgeschlagen",
  "mfa.enabled": "Zwei-Faktor-Anmeldung aktiviert",
  "mfa.disabled": "Zwei-Faktor-Anmeldung deaktiviert",
  "mfa.recovery_code_used": "Wiederherstellungscode verwendet",
  "password.changed": "Passwort geändert",
  "user.created": "Konto angelegt",
  "user.email_changed": "E-Mail-Adresse geändert",
  "user.profile_updated": "Profil geändert",
  "session.revoked": "Sitzung beendet",
  "session.revoked_all": "Alle anderen Sitzungen beendet",
  "member.invited": "Person eingeladen",
  "member.invitation_revoked": "Einladung zurückgezogen",
  "member.joined": "Workspace beigetreten",
  "member.role_changed": "Rolle geändert",
  "member.role_synced": "Rolle aus SSO-Gruppen übernommen",
  "member.removed": "Mitglied entfernt",
  "member.left": "Workspace verlassen",
  "workspace.created": "Workspace angelegt",
  "workspace.updated": "Workspace-Einstellungen geändert",
  "workspace.exported": "Daten exportiert",
  "workspace.deleted": "Workspace gelöscht",
  "workspace.ownership_transferred": "Inhaberschaft übertragen",
  "form.created": "Formular angelegt",
  "form.published": "Formular veröffentlicht",
  "form.paused": "Formular pausiert",
  "form.archived": "Formular archiviert",
  "form.draft": "Formular in Entwurf zurückgesetzt",
  "form.deleted": "Formular gelöscht",
  "form.settings_changed": "Veröffentlichungseinstellungen geändert",
  "form.version_restored": "Version als Entwurf wiederhergestellt",
};

export const ROLE_NAMES: Record<string, string> = { owner: "Inhaber", admin: "Administrator", editor: "Bearbeiter", reviewer: "Prüfer", viewer: "Leser" };

export function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  const [area, verb] = action.split(".");
  const areas: Record<string, string> = { submission: "Antwort", submissions: "Antworten", workflow: "Automation", approval: "Freigabe", token: "API-Schlüssel", api_token: "API-Schlüssel", file: "Datei", webhook: "Webhook", block: "Baustein", form: "Formular" };
  return areas[area] ? `${areas[area]}: ${verb?.replace(/_/g, " ")}` : action;
}

/** Kurzer, unbedenklicher Zusatz aus meta – nur bekannte, nicht sensible Schlüssel. */
export function auditDetail(action: string, meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof meta.from === "string" && typeof meta.to === "string") parts.push(`${ROLE_NAMES[meta.from] ?? meta.from} → ${ROLE_NAMES[meta.to] ?? meta.to}`);
  else if (typeof meta.role === "string") parts.push(ROLE_NAMES[meta.role] ?? meta.role);
  if (typeof meta.version === "number") parts.push(`Version ${meta.version}`);
  if (action === "login.failed" && typeof meta.reason === "string") parts.push({ unknown: "unbekanntes Konto", password: "falsches Passwort", disabled: "Konto gesperrt" }[meta.reason] ?? "");
  if (typeof meta.count === "number") parts.push(`${meta.count}`);
  if (typeof meta.submissions === "number") parts.push(`${meta.forms ?? 0} Formulare, ${meta.submissions} Antworten`);
  if (meta.mfa === true) parts.push("mit Zwei-Faktor");
  if (meta.sso === true || meta.via === "sso") parts.push("über SSO");
  if (meta.via === "invitation") parts.push("über Einladung");
  return parts.filter(Boolean).join(" · ");
}
