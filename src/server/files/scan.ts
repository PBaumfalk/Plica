/**
 * Virenprüfung über clamd (INSTREAM). Ohne konfigurierten Scanner bleiben
 * Dateien im Status „unscanned“ (Quarantäne): Sie werden gespeichert, aber
 * erst nach ausdrücklicher Freigabe durch eine berechtigte Person geöffnet.
 */
import "server-only";
import net from "node:net";
import { config } from "../config";

export type ScanResult = { status: "clean" | "infected" | "unscanned"; note?: string };

export async function scanBuffer(buf: Buffer): Promise<ScanResult> {
  const host = config().CLAMAV_HOST;
  if (!host) return { status: "unscanned", note: "Kein Virenscanner konfiguriert" };
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: config().CLAMAV_PORT });
    let out = "";
    const done = (r: ScanResult) => {
      sock.destroy();
      resolve(r);
    };
    sock.setTimeout(30_000, () => done({ status: "unscanned", note: "Virenscanner antwortet nicht" }));
    sock.on("error", () => done({ status: "unscanned", note: "Virenscanner nicht erreichbar" }));
    sock.on("data", (d) => (out += d.toString()));
    sock.on("end", () => {
      if (/OK\0?$/.test(out.trim())) done({ status: "clean" });
      else if (/FOUND/.test(out)) done({ status: "infected", note: out.replace(/^stream:\s*/, "").replace(/\0/g, "").trim() });
      else done({ status: "unscanned", note: "Unklare Antwort des Virenscanners" });
    });
    sock.on("connect", () => {
      sock.write("zINSTREAM\0");
      for (let i = 0; i < buf.length; i += 64 * 1024) {
        const chunk = buf.subarray(i, i + 64 * 1024);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(chunk.length);
        sock.write(len);
        sock.write(chunk);
      }
      sock.write(Buffer.alloc(4));
    });
  });
}

/** Erreichbarkeit des Virenscanners (PING/PONG, 2 s). Ohne Konfiguration: „nicht konfiguriert“. */
export async function scannerStatus(): Promise<"ok" | "nicht erreichbar" | "nicht konfiguriert"> {
  const host = config().CLAMAV_HOST;
  if (!host) return "nicht konfiguriert";
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: config().CLAMAV_PORT });
    let out = "";
    const done = (r: "ok" | "nicht erreichbar") => {
      sock.destroy();
      resolve(r);
    };
    sock.setTimeout(2000, () => done("nicht erreichbar"));
    sock.on("error", () => done("nicht erreichbar"));
    sock.on("data", (d) => {
      out += d.toString();
      if (out.includes("PONG")) done("ok");
    });
    sock.on("connect", () => sock.write("zPING\0"));
  });
}
