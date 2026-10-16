import { describe, expect, it } from "vitest";
import { factsIn, parseCsv, toCsv, validateRewrite } from "../../scripts/eval/adapt-lib";

const original = "The plan paid $0.00 of the $2,400.00 billed. You may file a written appeal within 180 days. Reason code: CO-50.";

describe("Adaption Labs rewrite validation", () => {
  it("lists the exact facts a block carries", () => {
    expect(factsIn(original)).toEqual(expect.arrayContaining(["$0.00", "$2,400.00", "180 days", "CO-50"]));
  });

  it("accepts a rewrite that keeps every fact and adds none", () => {
    const r = "Of the $2,400.00 that was billed, your plan paid $0.00 (reason code: CO-50). A written appeal can be filed within 180 days.";
    expect(validateRewrite(original, r)).toEqual({ ok: true });
  });

  it("rejects a rewrite that drops a figure", () => {
    const r = "Your plan paid nothing toward the bill. A written appeal can be filed within 180 days. Reason code: CO-50.";
    const c = validateRewrite(original, r);
    expect(c.ok).toBe(false);
    expect(!c.ok && c.reason).toMatch(/lost "\$0\.00"/);
  });

  it("rejects a rewrite that invents a figure the truth does not know", () => {
    const r = "The plan paid $0.00 of the $2,400.00 billed, so you may owe $2,400.00 plus a $35.00 fee. Appeal within 180 days. Reason code: CO-50.";
    const c = validateRewrite(original, r);
    expect(!c.ok && c.reason).toMatch(/introduced "\$35\.00"/);
  });

  it("rejects a rewrite that adds a labelled signal such as an emergency", () => {
    const r = "For this emergency visit, the plan paid $0.00 of the $2,400.00 billed. You may file a written appeal within 180 days. Reason code: CO-50.";
    const c = validateRewrite(original, r);
    expect(!c.ok && c.reason).toMatch(/added signal emergency/);
  });

  it("rejects an unchanged or empty rewrite", () => {
    expect(validateRewrite(original, original).ok).toBe(false);
    expect(validateRewrite(original, "  ").ok).toBe(false);
  });

  it("round-trips CSV cells with commas, quotes and line breaks", () => {
    const rows = [{ id: "a", text: 'He said "no", then\nleft.' }];
    expect(parseCsv(toCsv(rows, ["id", "text"]))).toEqual(rows);
  });
});
