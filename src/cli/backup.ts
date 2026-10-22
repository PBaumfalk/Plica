/**
 * Sicherung und Wiederherstellung: Datenbank (pg_dump, Custom-Format)
 * plus alle Objekte aus dem S3-Bucket in EINER .tar.gz-Datei mit Manifest
 * und SHA-256-Prüfsummen. Geschrieben wird erst in eine .tmp-Datei, die
 * nach erfolgreicher Prüfung umbenannt wird – ein Abbruch hinterlässt nie
 * eine scheinbar gültige Sicherung.
 */
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Manifest {
  format: "plica-backup";
  version: 1;
  createdAt: string;
  appVersion: string;
  database: { file: string; sha256: string; size: number };
  objects: { key: string; file: string; sha256: string; size: number; contentType?: string }[];
}

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`${name} ist nicht gesetzt.`);
  return v;
}

function s3() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: env("S3_REGION", "us-east-1"),
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    credentials: { accessKeyId: env("S3_ACCESS_KEY"), secretAccessKey: env("S3_SECRET_KEY") },
  });
}
const bucket = () => env("S3_BUCKET", "plica");

function run(cmd: string, args: string[], opts: { stdinFile?: string } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [opts.stdinFile ? "pipe" : "ignore", "inherit", "pipe"] });
    let err = "";
    p.stderr?.on("data", (d) => (err += d.toString()));
    if (opts.stdinFile) createReadStream(opts.stdinFile).pipe(p.stdin!);
    p.on("error", (e) => reject(new Error(`${cmd} konnte nicht gestartet werden: ${e.message}`)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} endete mit Code ${code}: ${err.trim().slice(-800)}`))));
  });
}

async function sha256File(file: string): Promise<string> {
  const h = createHash("sha256");
  await new Promise<void>((res, rej) => createReadStream(file).on("data", (d) => h.update(d)).on("end", () => res()).on("error", rej));
  return h.digest("hex");
}

export function backupDir() {
  return process.env.BACKUP_DIR ?? (existsSync("/backups") ? "/backups" : path.resolve("backups"));
}

/** Postgres-URL ohne Treiber-Parameter für pg_dump/pg_restore. */
function pgUrl() {
  return env("DATABASE_URL");
}

export async function createBackup(kind = "manuell"): Promise<string> {
  const dir = backupDir();
  await mkdir(dir, { recursive: true });
  // Arbeitsordner im Sicherungsvolume, nicht in /tmp (im Container nur ein kleines tmpfs)
  const work = await mkdtemp(path.join(dir, ".arbeit-"));
  try {
    const dbFile = path.join(work, "database.dump");
    await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${dbFile}`, pgUrl()]);

    const client = s3();
    const objects: Manifest["objects"] = [];
    await mkdir(path.join(work, "objects"), { recursive: true });
    let token: string | undefined;
    let n = 0;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token }));
      for (const o of page.Contents ?? []) {
        if (!o.Key) continue;
        const res = await client.send(new GetObjectCommand({ Bucket: bucket(), Key: o.Key }));
        const buf = Buffer.from(await res.Body!.transformToByteArray());
        const file = `objects/${String(n++).padStart(7, "0")}`;
        await writeFile(path.join(work, file), buf);
        objects.push({ key: o.Key, file, sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length, contentType: res.ContentType });
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    const manifest: Manifest = {
      format: "plica-backup",
      version: 1,
      createdAt: new Date().toISOString(),
      appVersion: process.env.PLICA_VERSION ?? "dev",
      database: { file: "database.dump", sha256: await sha256File(dbFile), size: (await stat(dbFile)).size },
      objects,
    };
    await writeFile(path.join(work, "manifest.json"), JSON.stringify(manifest, null, 2));

    const stamp = manifest.createdAt.replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const final = path.join(dir, `plica-${kind}-${stamp}.tar.gz`);
    const tmp = `${final}.tmp`;
    await run("tar", ["-czf", tmp, "-C", work, "."]);
    await verifyBackup(tmp);
    await rename(tmp, final);
    return final;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function extract(file: string): Promise<{ dir: string; manifest: Manifest }> {
  await mkdir(backupDir(), { recursive: true });
  const dir = await mkdtemp(path.join(backupDir(), ".arbeit-"));
  await run("tar", ["-xzf", file, "-C", dir]);
  const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as Manifest;
  if (manifest.format !== "plica-backup" || manifest.version !== 1) throw new Error("Keine gültige PLICA-Sicherung.");
  return { dir, manifest };
}

async function checkExtracted(dir: string, m: Manifest) {
  const problems: string[] = [];
  const safe = (f: string) => !f.includes("..") && !path.isAbsolute(f);
  if (!safe(m.database.file) || (await sha256File(path.join(dir, m.database.file))) !== m.database.sha256) problems.push("Datenbankabzug beschädigt");
  for (const o of m.objects) {
    if (!safe(o.file)) {
      problems.push(`Ungültiger Pfad ${o.file}`);
      continue;
    }
    const p = path.join(dir, o.file);
    if (!existsSync(p) || (await sha256File(p)) !== o.sha256) problems.push(`Datei ${o.key} beschädigt`);
  }
  if (problems.length) throw new Error(`Sicherung fehlerhaft: ${problems.slice(0, 5).join("; ")}${problems.length > 5 ? ` (+${problems.length - 5})` : ""}`);
}

export async function verifyBackup(file: string): Promise<Manifest> {
  const { dir, manifest } = await extract(file);
  try {
    await checkExtracted(dir, manifest);
    return manifest;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function restoreBackup(file: string): Promise<Manifest> {
  const { dir, manifest } = await extract(file);
  try {
    await checkExtracted(dir, manifest);
    // Datenbank: Schema leeren und vollständig wiederherstellen
    await run("psql", ["--quiet", "--set=ON_ERROR_STOP=1", "-c", "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;", pgUrl()]);
    await run("pg_restore", ["--no-owner", "--no-privileges", "--exit-on-error", `--dbname=${pgUrl()}`, path.join(dir, manifest.database.file)]);

    // Objekte: Bucket leeren, dann alle Dateien zurückschreiben
    const client = s3();
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket() }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket() }));
    }
    let token: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token }));
      const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys } }));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    for (const o of manifest.objects) {
      await client.send(new PutObjectCommand({ Bucket: bucket(), Key: o.key, Body: await readFile(path.join(dir, o.file)), ContentType: o.contentType }));
    }
    return manifest;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function listBackups() {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".tar.gz"));
  const out = await Promise.all(files.map(async (f) => ({ file: path.join(dir, f), size: (await stat(path.join(dir, f))).size, mtime: (await stat(path.join(dir, f))).mtime })));
  return out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

/** Ältere automatische Sicherungen entfernen (BACKUP_KEEP, Standard 14). */
export async function rotateBackups(keep = Number(process.env.BACKUP_KEEP ?? 14)) {
  const auto = (await listBackups()).filter((b) => path.basename(b.file).startsWith("plica-auto-"));
  for (const b of auto.slice(keep)) await rm(b.file, { force: true });
}

