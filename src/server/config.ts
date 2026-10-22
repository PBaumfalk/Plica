/**
 * Zentrale Konfiguration. Alle Werte kommen aus Umgebungsvariablen und
 * werden beim ersten Zugriff geprüft – fehlerhafte Konfiguration bricht
 * den Start mit verständlicher Meldung ab, statt später seltsam zu scheitern.
 */
import "server-only";
import { z } from "zod";

const bool = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

const Env = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().transform((u) => u.replace(/\/$/, "")),
  /** Optional getrennte öffentliche Adresse für Formulare (z. B. https://formulare.kanzlei.de). */
  PUBLIC_URL: z.string().url().optional().transform((u) => u?.replace(/\/$/, "")),
  SECRET_KEY: z.string().min(32, "SECRET_KEY muss mindestens 32 Zeichen lang sein (openssl rand -hex 32)."),
  PLICA_ENV: z.enum(["development", "production", "test"]).default("production"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("plica"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: bool.default(true),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("PLICA <plica@localhost>"),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().int().default(3310),
  /** Uploads ohne Virenprüfung bleiben in Quarantäne, bis jemand sie freigibt. */
  UPLOAD_MAX_MB: z.coerce.number().min(1).max(500).default(25),
  SETUP_CODE: z.string().optional(),
  /** Wo Formulare per iframe eingebettet werden dürfen (CSP frame-ancestors), z. B. "https://www.kanzlei.de". */
  EMBED_ORIGINS: z.string().default("*"),
  TRUST_PROXY: bool.default(false),
  /** Webhooks an private Netze erlauben (nur für interne Systeme wie j-lawyer im LAN). */
  WEBHOOK_ALLOW_PRIVATE: bool.default(false),
  /** Optionale KI-Anbindung (OpenAI-kompatible API, z. B. lokal mit Ollama). */
  AI_BASE_URL: z.string().url().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

export type Config = z.infer<typeof Env> & { secureCookies: boolean; publicUrl: string };

let cached: Config | null = null;

export function config(): Config {
  if (cached) return cached;
  const parsed = Env.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`PLICA: Konfiguration ungültig:\n${lines}\nSiehe .env.example.`);
  }
  const c = parsed.data;
  if (c.PLICA_ENV === "production" && /dev-only/.test(c.SECRET_KEY)) throw new Error("PLICA: In Produktion darf kein Entwicklungs-SECRET_KEY verwendet werden.");
  cached = { ...c, secureCookies: c.APP_URL.startsWith("https://"), publicUrl: c.PUBLIC_URL ?? c.APP_URL };
  return cached;
}

export const isDev = () => config().PLICA_ENV !== "production";
