import { describe, expect, it } from "vitest";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { situation } from "./fixtures";
import type { Situation } from "@/lib/schemas/situation";

const run = (s: Situation) => computeRights(s, ALL_RULES, HELP_RESOURCES);
const ids = (r: ReturnType<typeof run>) => r.rules.map((x) => x.rule.id);

/**
 * Golden table. Each row is a situation and the exact set of rule ids the engine must
 * return (order-insensitive), plus deadline expectations. Deterministic: any diff is a bug
 * in the engine or an intentional dataset change that must update this table.
 */
const GOLDEN: Array<{
  name: string;
  s: Situation;
  expect_ids: string[];
  expect_deadlines?: Array<{ rule_id: string; due: string | null; status: string }>;
}> = [
  {
    name: "NY · employer · self-funded unknown · medical necessity",
    s: situation(),
    expect_ids: [
      "fed.internal_appeal.filing_window",
      "fed.internal_appeal.decision_windows",
      "fed.claim_file.free_copies",
      "fed.internal_appeal.independent_reviewer",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
      "fed.external_review.filing_window",
      "fed.external_review.decision_windows",
      "fed.erisa.self_funded_route",
      "ny.external_appeal.filing_window",
      "ny.external_appeal.scope",
      "ny.external_appeal.fee",
      "ny.external_appeal.decision_windows",
      "ny.internal_appeal.deemed_reversal",
    ],
    expect_deadlines: [
      { rule_id: "fed.internal_appeal.filing_window", due: "2027-02-28", status: "ok" },
      { rule_id: "fed.external_review.filing_window", due: null, status: "pending" },
      { rule_id: "ny.external_appeal.filing_window", due: null, status: "pending" },
    ],
  },
  {
    name: "NY · employer · fully insured · medical necessity (no ERISA route, no funding caveat)",
    s: situation({ self_funded: "no" }),
    expect_ids: [
      "fed.internal_appeal.filing_window",
      "fed.internal_appeal.decision_windows",
      "fed.claim_file.free_copies",
      "fed.internal_appeal.independent_reviewer",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
      "fed.external_review.filing_window",
      "fed.external_review.decision_windows",
      "ny.external_appeal.filing_window",
      "ny.external_appeal.scope",
      "ny.external_appeal.fee",
      "ny.external_appeal.decision_windows",
      "ny.internal_appeal.deemed_reversal",
    ],
  },
  {
    name: "NY · employer · self-funded · medical necessity (state overlay drops out)",
    s: situation({ self_funded: "yes" }),
    expect_ids: [
      "fed.internal_appeal.filing_window",
      "fed.internal_appeal.decision_windows",
      "fed.claim_file.free_copies",
      "fed.internal_appeal.independent_reviewer",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
      "fed.external_review.filing_window",
      "fed.external_review.decision_windows",
      "fed.erisa.self_funded_route",
    ],
  },
  {
    name: "TX · marketplace · emergency · out of network (NSA first)",
    s: situation(
      { state: "TX", plan_source: "marketplace", self_funded: "no", emergency: "yes" },
      { state_hint: { value: "TX", confidence: 0.9, quote: "Houston, TX", page: 1 }, denial_category: { value: "out_of_network", confidence: 0.9, quote: "out-of-network", page: 1 } },
    ),
    expect_ids: [
      "nsa.emergency.no_balance_billing",
      "nsa.facility.no_consent_for_ancillary",
      "nsa.emergency.counts_in_network",
      "fed.internal_appeal.filing_window",
      "fed.external_review.filing_window",
      "fed.claim_file.free_copies",
      "fed.internal_appeal.decision_windows",
      "fed.external_review.decision_windows",
      "tx.regulator.scope",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
      "nsa.complaint.help_desk",
    ],
  },
  {
    name: "CA · direct · not covered (no IMR, no external review for pure plan-terms denial)",
    s: situation(
      { state: "CA", plan_source: "direct", self_funded: "no" },
      { state_hint: { value: "CA", confidence: 0.9, quote: "Sacramento, CA", page: 1 }, denial_category: { value: "not_covered", confidence: 0.9, quote: "not a covered benefit", page: 1 } },
    ),
    expect_ids: [
      "fed.internal_appeal.filing_window",
      "ca.grievance.then_dmhc_30_days",
      "fed.claim_file.free_copies",
      "fed.claim_file.codes_meaning",
      "fed.internal_appeal.decision_windows",
      "fed.external_review.decision_windows",
      "ca.regulator.which_one",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
    ],
  },
  {
    name: "CA · employer · fully insured · prior auth · urgent (expedited on top, IMR available)",
    s: situation(
      { state: "CA", self_funded: "no", urgent: "yes" },
      { state_hint: { value: "CA", confidence: 0.9, quote: "Los Angeles, CA", page: 1 }, denial_category: { value: "prior_auth", confidence: 0.9, quote: "no prior authorization", page: 1 } },
    ),
    expect_ids: [
      "fed.expedited.urgent_care",
      "fed.internal_appeal.filing_window",
      "fed.external_review.filing_window",
      "ca.imr.filing_window",
      "ca.grievance.then_dmhc_30_days",
      "fed.claim_file.free_copies",
      "ca.grievance.written_reasons",
      "fed.internal_appeal.independent_reviewer",
      "fed.internal_appeal.decision_windows",
      "fed.external_review.decision_windows",
      "ca.imr.decision_windows",
      "ca.imr.free",
      "ca.regulator.which_one",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
    ],
  },
  {
    name: "FL · unsupported state · federal only",
    s: situation({ state: "FL", self_funded: "no" }, { state_hint: { value: "FL", confidence: 0.9, quote: "Miami, FL", page: 1 } }),
    expect_ids: [
      "fed.internal_appeal.filing_window",
      "fed.external_review.filing_window",
      "fed.claim_file.free_copies",
      "fed.internal_appeal.independent_reviewer",
      "fed.internal_appeal.decision_windows",
      "fed.external_review.decision_windows",
      "fed.notice.required_content",
      "fed.deemed_exhaustion",
    ],
  },
];

describe("rules engine golden table", () => {
  it.each(GOLDEN.map((g) => [g.name, g] as const))("%s", (_name, g) => {
    const r = run(g.s);
    expect(ids(r).sort()).toEqual([...g.expect_ids].sort());
    if (g.expect_deadlines) {
      for (const d of g.expect_deadlines) {
        const got = r.deadlines.find((x) => x.rule_id === d.rule_id);
        expect(got, `missing deadline ${d.rule_id}`).toBeDefined();
        expect(got!.due).toBe(d.due);
        expect(got!.status).toBe(d.status);
      }
    }
  });
});

describe("rules engine behaviour", () => {
  it("is deterministic and pure", () => {
    const s = situation();
    expect(run(s)).toEqual(run(s));
  });

  it("orders rules by priority (NSA first for emergencies)", () => {
    const r = run(situation({ state: "TX", self_funded: "no", emergency: "yes" }, { denial_category: { value: "out_of_network", confidence: 1, quote: "", page: 1 } }));
    expect(ids(r)[0]).toBe("nsa.emergency.no_balance_billing");
  });

  it("marks state rules with a caveat when funding is unknown, and none when fully insured", () => {
    const unknown = run(situation({ self_funded: "unknown" }));
    const ny = unknown.rules.find((x) => x.rule.id === "ny.external_appeal.filing_window")!;
    expect(ny.caveat).toBeTruthy();
    const insured = run(situation({ self_funded: "no" }));
    const ny2 = insured.rules.find((x) => x.rule.id === "ny.external_appeal.filing_window")!;
    expect(ny2.caveat).toBeUndefined();
  });

  it("uses the federal route and a note for unsupported states", () => {
    const r = run(situation({ state: "OH" }));
    expect(r.route).toBe("federal_only");
    expect(r.unsupported_note).toContain("OH");
    expect(r.rules.every((x) => x.rule.jurisdiction === "federal" || x.rule.jurisdiction === "nsa")).toBe(true);
  });

  it("computes 180-day internal appeal deadline with calendar math", () => {
    const r = run(situation({ anchor_dates: { letter_date: "2026-01-31" }, today: "2026-02-01" }));
    const d = r.deadlines.find((x) => x.rule_id === "fed.internal_appeal.filing_window")!;
    expect(d.due).toBe("2026-07-30");
    expect(d.days_left).toBe(179);
    expect(d.status).toBe("ok");
  });

  it("computes external review 4 months after the final internal denial", () => {
    const r = run(situation({ self_funded: "no", anchor_dates: { letter_date: "2026-05-01", final_internal_denial_date: "2026-06-30" }, today: "2026-07-01" }));
    const d = r.deadlines.find((x) => x.rule_id === "fed.external_review.filing_window")!;
    expect(d.due).toBe("2026-10-30");
    expect(d.status).toBe("ok");
  });

  it("flags a letter that states a shorter deadline than the legal minimum and keeps the legal one", () => {
    const r = run(situation({}, { stated_appeal_deadline: { value: { kind: "days", days: 60 }, confidence: 0.9, quote: "within 60 days", page: 1 } }));
    const d = r.deadlines.find((x) => x.rule_id === "fed.internal_appeal.filing_window")!;
    expect(d.discrepancy).toBe("letter_shorter");
    expect(d.letter_stated).toBe("2026-10-31");
    expect(d.due).toBe("2027-02-28");
  });

  it("uses the letter's deadline when it is more generous", () => {
    const r = run(situation({}, { stated_appeal_deadline: { value: { kind: "date", date: "2027-06-01" }, confidence: 0.9, quote: "by June 1, 2027", page: 1 } }));
    const d = r.deadlines.find((x) => x.rule_id === "fed.internal_appeal.filing_window")!;
    expect(d.discrepancy).toBe("letter_longer");
    expect(d.due).toBe("2027-06-01");
  });

  it("reports soon / urgent / passed statuses", () => {
    const at = (today: string) => run(situation({ today })).deadlines[0].status;
    expect(at("2027-01-31")).toBe("soon"); // 28 days left
    expect(at("2027-02-25")).toBe("urgent"); // 3 days left
    expect(at("2027-03-01")).toBe("passed");
  });

  it("ranks human help: state CAP first, EBSA first when self-funded, No Surprises desk for OON", () => {
    expect(run(situation({ self_funded: "no" })).help[0].id).toBe("ny.cha");
    expect(run(situation({ self_funded: "yes" })).help[0].id).toBe("fed.dol.ebsa");
    const oon = run(situation({ state: "TX", self_funded: "no", emergency: "yes" }));
    expect(oon.help[0].id).toBe("fed.cms.no_surprises_help_desk");
  });
});
