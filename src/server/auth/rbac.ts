/**
 * Rollen und Berechtigungen. Die einzige Quelle der Wahrheit – sowohl
 * Server Actions als auch API-Routen prüfen hiergegen. Die UI blendet
 * nur aus; sie entscheidet nie.
 */
import type { Role } from "../db/schema";

export const PERMISSIONS = [
  "forms.read",
  "forms.write",
  "forms.publish",
  "forms.delete",
  "submissions.read",
  "submissions.update",
  "submissions.delete",
  "submissions.export",
  "approvals.decide",
  "workflows.write",
  "members.manage",
  "workspace.manage",
  "tokens.manage",
  "audit.read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ["forms.read", "submissions.read"];
const REVIEWER: Permission[] = [...VIEWER, "submissions.update", "approvals.decide"];
const EDITOR: Permission[] = [...REVIEWER, "forms.write", "forms.publish", "submissions.export", "workflows.write"];
const ADMIN: Permission[] = [...EDITOR, "forms.delete", "submissions.delete", "members.manage", "workspace.manage", "tokens.manage", "audit.read"];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  viewer: new Set(VIEWER),
  reviewer: new Set(REVIEWER),
  editor: new Set(EDITOR),
  admin: new Set(ADMIN),
  owner: new Set(PERMISSIONS),
};

export const ROLE_RANK: Record<Role, number> = { viewer: 1, reviewer: 2, editor: 3, admin: 4, owner: 5 };

export const ROLE_LABELS: Record<Role, { name: string; description: string }> = {
  owner: { name: "Inhaber", description: "Alles, einschließlich Workspace löschen und Inhaberschaft übertragen." },
  admin: { name: "Administrator", description: "Mitglieder, Einstellungen, API-Schlüssel und Löschungen." },
  editor: { name: "Bearbeiter", description: "Formulare bauen, veröffentlichen, automatisieren und exportieren." },
  reviewer: { name: "Prüfer", description: "Antworten bearbeiten, kommentieren und Freigaben entscheiden." },
  viewer: { name: "Leser", description: "Formulare und Antworten nur ansehen." },
};

export function can(role: Role | null | undefined, perm: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role].has(perm);
}

/** Darf `actor` einem Mitglied die Rolle `target` geben bzw. es verwalten? */
export function canAssign(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && ROLE_RANK[target] < ROLE_RANK.admin;
}
