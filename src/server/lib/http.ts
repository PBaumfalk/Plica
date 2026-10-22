import "server-only";
import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200, headers?: Record<string, string>) => NextResponse.json(data, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });
export const problem = (status: number, message: string, extra?: Record<string, unknown>) => json({ error: { message, ...extra } }, status);

/** Request-Body begrenzen, bevor er gelesen wird. */
export function tooLarge(req: Request, maxBytes: number): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  return !Number.isFinite(len) || len > maxBytes;
}

export async function readJson<T>(req: Request, maxBytes: number): Promise<T | null> {
  if (tooLarge(req, maxBytes)) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
