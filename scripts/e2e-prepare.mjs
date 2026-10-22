// Frische E2E-Umgebung: Datenbank plica_e2e leeren und migrieren, Bucket leeren.
// Nur für lokale Tests gegen den Dev-Stack (docker/compose.dev.yml).
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

const url = new URL(process.env.DATABASE_URL);
const name = url.pathname.slice(1);
if (!/e2e/.test(name)) throw new Error(`Sicherheitsabbruch: ${name} ist keine E2E-Datenbank.`);
const admin = postgres({ host: url.hostname, port: Number(url.port), user: url.username, password: decodeURIComponent(url.password), database: "postgres", max: 1, onnotice: () => {} });
if (!(await admin`select 1 from pg_database where datname = ${name}`).length) await admin.unsafe(`create database "${name}"`);
await admin.end();
const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
await sql.unsafe("drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;");
await migrate(drizzle({ client: sql }), { migrationsFolder: path.join(import.meta.dirname, "..", "drizzle") });
await sql.end();

const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
try {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET }));
  if (list.Contents?.length) await s3.send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET, Delete: { Objects: list.Contents.map((o) => ({ Key: o.Key })) } }));
} catch {
  /* Bucket existiert noch nicht – legt die App an */
}
console.log("E2E-Umgebung bereit.");
