/** Fachlicher Fehler mit Meldung für die Oberfläche (kein Stacktrace nach außen). */
export class ServiceError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
  }
}

export interface Actor {
  userId: string;
  workspaceId: string;
  role: "owner" | "admin" | "editor" | "reviewer" | "viewer";
}
