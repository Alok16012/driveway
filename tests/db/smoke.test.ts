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
});
