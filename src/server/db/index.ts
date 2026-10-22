import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

const g = globalThis as unknown as { __plicaSql?: postgres.Sql };

function client() {
  // Im Dev-Modus über Hot-Reloads hinweg wiederverwenden.
  g.__plicaSql ??= postgres(config().DATABASE_URL, { max: 10, idle_timeout: 30, onnotice: () => {} });
  return g.__plicaSql;
}

export const db = drizzle({ client: client(), schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { schema };
