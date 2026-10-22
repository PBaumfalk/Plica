"use server";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "../audit";
import { hashPassword, passwordProblem, verifyPassword } from "../auth/password";
import { assertViewer, createSession, destroySession, getViewer } from "../auth/session";
import { db, schema } from "../db";
import { decrypt, encrypt, randomToken, safeEqual, sha256 } from "../lib/crypto";
import { loginThrottle, rateLimit } from "../lib/ratelimit";
import { clientIp, ipKey } from "../lib/request";
import { consumeSetupCode, needsSetup, setupCode } from "../setup";
import { action, fail, ok, type ActionResult } from "./result";

const SetupInput = z.object({
  code: z.string().trim().min(1, "Bitte den Einrichtungscode eingeben."),
  name: z.string().trim().min(1, "Bitte deinen Namen angeben.").max(120),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben.").max(254),
  password: z.string(),
  workspace: z.string().trim().min(1, "Bitte einen Namen für den Workspace angeben.").max(120),
});

export async function checkSetupCode(code: string): Promise<ActionResult<null>> {
  return action(async () => {
    const ip = clientIp(await headers());
    if (!rateLimit(`setup:${ipKey(ip)}`, 10, 60_000).ok) return fail("Zu viele Versuche. Bitte warte eine Minute.");
    if (!(await needsSetup())) return fail("PLICA ist bereits eingerichtet.");
    if (!safeEqual(code.trim(), await setupCode())) return fail("Der Code stimmt nicht. Du findest ihn im Server-Log (docker compose logs plica).");
    return ok(null);
  });
}

export async function completeSetup(input: z.input<typeof SetupInput>): Promise<ActionResult<null>> {
  return action(async () => {
    const ip = clientIp(await headers());
    if (!rateLimit(`setup:${ipKey(ip)}`, 10, 60_000).ok) return fail("Zu viele Versuche. Bitte warte eine Minute.");
    const data = SetupInput.parse(input);
    if (!(await needsSetup())) return fail("PLICA ist bereits eingerichtet.");
    if (!safeEqual(data.code, await setupCode())) return fail("Der Einrichtungscode stimmt nicht.", { code: "Der Code stimmt nicht." });
    const pwProblem = passwordProblem(data.password, data.email);
    if (pwProblem) return fail(pwProblem, { password: pwProblem });

    const passwordHash = await hashPassword(data.password);
    const { userId, workspaceId } = await db.transaction(async (tx) => {
      // Sperre gegen parallele Einrichtung
      await tx.execute(sql`select pg_advisory_xact_lock(4711)`);
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users);
      if (n > 0) throw new Error("already set up");
      const [u] = await tx.insert(schema.users).values({ email: data.email, name: data.name, passwordHash, isInstanceAdmin: true }).returning();
      const [w] = await tx.insert(schema.workspaces).values({ name: data.workspace, webhookSecret: encrypt(randomToken(32), "webhook") }).returning();
      await tx.insert(schema.memberships).values({ workspaceId: w.id, userId: u.id, role: "owner" });
      return { userId: u.id, workspaceId: w.id };
    });
    await consumeSetupCode();
    await audit({ workspaceId, userId, action: "setup.complete" });
    await createSession(userId, { workspaceId });
    return ok(null);
  });
}

const LoginInput = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().max(200) });

export async function login(input: z.input<typeof LoginInput>): Promise<ActionResult<{ next: "app" | "mfa" }>> {
  return action(async () => {
    const { email, password } = LoginInput.parse(input);
    const ip = ipKey(clientIp(await headers()));
    const keys = [`ip:${ip}`, `acct:${email}`];
    if (!rateLimit(`login:${ip}`, 20, 60_000).ok) return fail("Zu viele Anmeldeversuche. Bitte warte eine Minute.");
    const wait = loginThrottle.check(keys);
    if (wait > 0) return fail(`Zu viele Fehlversuche. Bitte warte ${wait} Sekunden.`);

    const user = await db.query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
    const valid = await verifyPassword(user?.passwordHash, password);
    if (!user || !valid || user.disabledAt) {
      loginThrottle.fail(keys);
      await audit({ userId: user?.id, action: "login.failed", meta: { reason: !user ? "unknown" : user.disabledAt ? "disabled" : "password" } });
      return fail("E-Mail oder Passwort stimmt nicht.");
    }
    loginThrottle.succeed(keys);
    await createSession(user.id, { mfaPending: user.totpEnabled });
    if (!user.totpEnabled) {
      await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
      await audit({ userId: user.id, action: "login.success" });
    }
    return ok({ next: user.totpEnabled ? "mfa" : "app" });
  });
}

function checkTotp(secretEnc: string, code: string): boolean {
  const secret = decrypt(secretEnc, "totp");
  try {
    return verifySync({ secret, token: code.replace(/\s/g, ""), epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}

export async function verifySecondFactor(code: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await getViewer();
    if (!v || !v.mfaPending) return fail("Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.");
    const keys = [`mfa:${v.user.id}`];
    const wait = loginThrottle.check(keys);
    if (wait > 0) return fail(`Zu viele Fehlversuche. Bitte warte ${wait} Sekunden.`);
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, v.user.id) });
    if (!user?.totpSecret) return fail("Zwei-Faktor-Anmeldung ist nicht eingerichtet.");
    let okCode = checkTotp(user.totpSecret, code);
    // Wiederherstellungscode (einmalig)
    if (!okCode && user.recoveryCodes?.length) {
      const h = sha256(code.trim().toUpperCase());
      if (user.recoveryCodes.includes(h)) {
        okCode = true;
        await db.update(schema.users).set({ recoveryCodes: user.recoveryCodes.filter((c) => c !== h) }).where(eq(schema.users.id, user.id));
        await audit({ userId: user.id, action: "mfa.recovery_code_used" });
      }
    }
    if (!okCode) {
      loginThrottle.fail(keys);
      return fail("Der Code stimmt nicht.");
    }
    loginThrottle.succeed(keys);
    await db.delete(schema.sessions).where(eq(schema.sessions.id, v.sessionId));
    await createSession(user.id);
    await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
    await audit({ userId: user.id, action: "login.success", meta: { mfa: true } });
    return ok(null);
  });
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ---------- TOTP einrichten ---------- */

export async function startTotpSetup(): Promise<ActionResult<{ secret: string; qr: string }>> {
  return action(async () => {
    const v = await assertViewer();
    const secret = generateSecret();
    await db.update(schema.users).set({ totpSecret: encrypt(secret, "totp"), totpEnabled: false }).where(and(eq(schema.users.id, v.user.id), eq(schema.users.totpEnabled, false)));
    const uri = generateURI({ secret, issuer: "PLICA", label: v.user.email });
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    return ok({ secret, qr });
  });
}

export async function confirmTotpSetup(code: string): Promise<ActionResult<{ recoveryCodes: string[] }>> {
  return action(async () => {
    const v = await assertViewer();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, v.user.id) });
    if (!user?.totpSecret || user.totpEnabled) return fail("Bitte die Einrichtung neu starten.");
    if (!checkTotp(user.totpSecret, code)) return fail("Der Code stimmt nicht. Prüfe die Uhrzeit deines Geräts.");
    const codes = Array.from({ length: 8 }, () => randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "X").slice(0, 8));
    await db.update(schema.users).set({ totpEnabled: true, recoveryCodes: codes.map((c) => sha256(c)) }).where(eq(schema.users.id, user.id));
    await audit({ userId: user.id, workspaceId: v.workspace.id, action: "mfa.enabled" });
    return ok({ recoveryCodes: codes });
  });
}

export async function disableTotp(password: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, v.user.id) });
    if (!user || !(await verifyPassword(user.passwordHash, password))) return fail("Das Passwort stimmt nicht.");
    await db.update(schema.users).set({ totpEnabled: false, totpSecret: null, recoveryCodes: null }).where(eq(schema.users.id, user.id));
    await audit({ userId: user.id, workspaceId: v.workspace.id, action: "mfa.disabled" });
    return ok(null);
  });
}

export async function changePassword(current: string, next: string): Promise<ActionResult<null>> {
  return action(async () => {
    const v = await assertViewer();
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, v.user.id) });
    if (!user || !(await verifyPassword(user.passwordHash, current))) return fail("Das aktuelle Passwort stimmt nicht.", { current: "Stimmt nicht." });
    const problem = passwordProblem(next, user.email);
    if (problem) return fail(problem, { next: problem });
    await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, user.id));
    // Alle anderen Sitzungen beenden
    await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), sql`${schema.sessions.id} <> ${v.sessionId}`));
    await audit({ userId: user.id, workspaceId: v.workspace.id, action: "password.changed" });
    return ok(null);
  });
}
