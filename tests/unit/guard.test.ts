import { describe, expect, it } from "vitest";
import { findCitations, findPlaceholders, findPrescriptive, stripUnknownCitations, unknownCitations } from "@/lib/ai/guard";

describe("prescriptive-language guard", () => {
  it("flags advice and outcome predictions", () => {
    expect(findPrescriptive("You should appeal right away.")).toEqual(["You should"]);
    expect(findPrescriptive("I recommend calling them. This is guaranteed to work.")).toEqual(["I recommend", "guaranteed"]);
    expect(findPrescriptive("Your appeal will win.")).toEqual(["will win"]);
    expect(findPrescriptive("This is not legal advice.")).toEqual(["legal advice"]);
    expect(findPrescriptive("You have a strong case.")).toEqual(["strong case"]);
  });

  it("accepts descriptive, sourced phrasing", () => {
    const ok = "Under federal rules, a plan generally must give at least 180 days to appeal. The letter says an appeal may be filed in writing. I request a copy of the claim file.";
    expect(findPrescriptive(ok)).toEqual([]);
  });

  it("is case-insensitive and de-duplicates exact repeats", () => {
    expect(findPrescriptive("you must. you must.")).toEqual(["you must"]);
    expect(findPrescriptive("YOU SHOULD").length).toBe(1);
  });
});

describe("citation guard", () => {
  const allowed = ["fed.claim_file.free_copies", "nsa.emergency.no_balance_billing"];
  const text = "I request the file. [[cite:fed.claim_file.free_copies]] The plan cannot bill me more. [[cite:nsa.emergency.no_balance_billing]] Also [[cite:made.up.rule]].";

  it("lists citations and finds the unknown ones", () => {
    expect(findCitations(text)).toEqual(["fed.claim_file.free_copies", "nsa.emergency.no_balance_billing", "made.up.rule"]);
    expect(unknownCitations(text, allowed)).toEqual(["made.up.rule"]);
  });

  it("strips only the unknown markers", () => {
    const out = stripUnknownCitations(text, allowed);
    expect(out).toContain("[[cite:fed.claim_file.free_copies]]");
    expect(out).not.toContain("made.up.rule");
  });
});

describe("placeholders", () => {
  it("collects [ADD: …] markers once each", () => {
    const t = "Dear [ADD: appeals department name], I am [ADD: your full name]. Again [ADD: your full name].";
    expect(findPlaceholders(t)).toEqual(["appeals department name", "your full name"]);
  });
});
