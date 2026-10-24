import { describe, expect, it } from "vitest";
import { createDb } from "./harness";

describe("migration loads", () => {
  it("creates schema and seeds", async () => {
    const t = await createDb();
    expect((await t.admin("select count(*)::int as n from public.vehicles"))[0].n).toBe(7);
    const u = await t.user();
    const q = await t.rpc(u, "quote", "cur", "dlf", true, null);
    expect(q.options.length).toBe(7);
  }, 30000);

  it("anon can't execute any public function", async () => {
    const t = await createDb();
    const rows = await t.admin(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    expect(rows.map((r: { proname: string }) => r.proname)).toEqual([]);
  }, 30000);
});
