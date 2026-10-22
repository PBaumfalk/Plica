import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Argon2id nach OWASP-Empfehlung (19 MiB, 2 Durchläufe).
const OPTS = { memoryCost: 19_456, timeCost: 2, parallelism: 1, algorithm: 2 } as const;
const DUMMY = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Q1dnI9KQ8Wv1n9pJJ0m0V0iJh3m3w9yGkq6V3eYw2nU";

const COMMON = new Set(["password", "passwort", "1234567890", "qwertzuiop", "passwort123", "password123", "administrator", "plica12345"]);

export function passwordProblem(pw: string, email?: string): string | null {
  if (pw.length < 10) return "Das Passwort muss mindestens 10 Zeichen lang sein.";
  if (pw.length > 200) return "Das Passwort darf höchstens 200 Zeichen lang sein.";
  if (COMMON.has(pw.toLowerCase())) return "Dieses Passwort ist zu verbreitet.";
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length > 3) return "Das Passwort darf nicht den E-Mail-Namen enthalten.";
  return null;
}

export const hashPassword = (pw: string) => hash(pw.normalize("NFKC"), OPTS);

/** Prüft auch bei unbekanntem Konto, damit die Laufzeit nichts verrät. */
export async function verifyPassword(stored: string | null | undefined, pw: string): Promise<boolean> {
  try {
    const ok = await verify(stored ?? DUMMY, pw.normalize("NFKC"));
    return !!stored && ok;
  } catch {
    return false;
  }
}
