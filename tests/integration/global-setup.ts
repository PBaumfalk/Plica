/**
 * Legt die Testdatenbank frisch an und migriert sie. Idempotent:
 * jede Ausführung beginnt mit einem leeren Schema.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://plica:plica-dev-only@127.0.0.1:4732/plica_test";
  const u = new URL(url);
  const dbName = u.pathname.slice(1);
  const admin = postgres({ host: u.hostname, port: Number(u.port), user: u.username, password: decodeURIComponent(u.password), database: "postgres", max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
  if (!exists.length) await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema if exists public cascade; create schema public;");
  await migrate(drizzle({ client: sql }), { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await sql.end();
}
