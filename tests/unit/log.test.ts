import { describe, expect, it } from "vitest";
import { safeError } from "@/server/lib/log";

describe("safeError", () => {
  it("entfernt Abfrageparameter (Antwortinhalte) aus Datenbankfehlern", () => {
    const pg = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505", constraint_name: "submissions_client_key_idx", table_name: "submissions" });
    const drizzle = Object.assign(new Error('Failed query: insert into "submissions" values ($1, $2)\nparams: Erika Mustermann,erika@example.de'), { cause: pg });
    const s = safeError(drizzle);
    expect(JSON.stringify(s)).not.toContain("Erika");
    expect(s).toMatchObject({ code: "23505", constraint: "submissions_client_key_idx", table: "submissions" });
  });
});
