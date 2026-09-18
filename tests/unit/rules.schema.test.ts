import { describe, expect, it } from "vitest";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { ALL_RULES, HELP_RESOURCES, RULE_FILES } from "@/lib/rules/load";
import { SUPPORTED_STATES } from "@/lib/schemas/core";

const MAX_STALE_DAYS = 45;

describe("rules dataset", () => {
  it("loads every file and every rule validates", () => {
    expect(Object.keys(RULE_FILES)).toEqual(["federal", "nsa", "ca", "ny", "tx"]);
    expect(ALL_RULES.length).toBeGreaterThan(20);
  });

  it.each(ALL_RULES.map((r) => [r.id, r] as const))("%s has a primary https source", (_id, rule) => {
    expect(rule.source_url).toMatch(/^https:\/\//);
    expect(rule.legal_ref.trim().length).toBeGreaterThan(3);
  });

  it.each(ALL_RULES.map((r) => [r.id, r] as const))("%s was verified recently", (_id, rule) => {
    const age = differenceInCalendarDays(new Date(), parseISO(rule.last_verified));
    expect(age, `${rule.id} last_verified is ${age} days old`).toBeLessThanOrEqual(MAX_STALE_DAYS);
    expect(age).toBeGreaterThanOrEqual(0);
  });

  it("consumer deadlines have an anchor and a positive amount", () => {
    for (const r of ALL_RULES.filter((r) => r.deadline?.who === "consumer")) {
      expect(r.category).toBe("deadline");
      expect(r.deadline!.amount).toBeGreaterThan(0);
    }
  });

  it("state rules are scoped to their state", () => {
    for (const r of ALL_RULES) {
      if (r.jurisdiction === "CA" || r.jurisdiction === "NY" || r.jurisdiction === "TX") {
        expect(r.applies_if.state).toEqual([r.jurisdiction]);
      }
    }
  });

  it("has human help for federal and every supported state", () => {
    expect(HELP_RESOURCES.some((h) => h.scope === "federal")).toBe(true);
    for (const s of SUPPORTED_STATES) {
      expect(HELP_RESOURCES.some((h) => h.scope === s), `no help resource for ${s}`).toBe(true);
    }
  });
});
