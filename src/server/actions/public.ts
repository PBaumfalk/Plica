"use server";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { verifyPassword } from "../auth/password";
import { db, schema } from "../db";
import { signPayload } from "../lib/crypto";
import { loginThrottle } from "../lib/ratelimit";
import { clientIp, ipKey } from "../lib/request";

export async function unlockForm(slug: string, password: string): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const ip = ipKey(clientIp(await headers()));
  const keys = [`unlock:${ip}:${slug}`];
  const wait = loginThrottle.check(keys);
  if (wait > 0) return { ok: false, error: `Zu viele Versuche. Bitte warten Sie ${wait} Sekunden.` };
  const form = await db.query.forms.findFirst({ where: and(eq(schema.forms.slug, String(slug).slice(0, 80)), isNull(schema.forms.deletedAt)), columns: { id: true, passwordHash: true } });
  if (!form?.passwordHash || !(await verifyPassword(form.passwordHash, String(password).slice(0, 200)))) {
    loginThrottle.fail(keys);
    return { ok: false, error: "Das Passwort stimmt nicht." };
  }
  loginThrottle.succeed(keys);
  return { ok: true, key: signPayload({ f: form.id }, "unlock", 12 * 3600) };
}
