import { DENIAL_CATEGORY_LABEL, isSupportedState, type ISODate } from "@/lib/schemas/core";
import type { Situation } from "@/lib/schemas/situation";
import { compareISO, computeDue, daysLeft, statusFor, type DeadlineStatus } from "./deadlines";
import type { DeadlineAnchor, HelpResource, Rule } from "./schema";

/*
 * The rules engine. Pure: (Situation, Rule[], HelpResource[]) -> RightsResult.
 * No I/O, no clock (uses situation.today), no model. This is the part of Overturn that
 * decides what applies; the language model only ever reads documents and writes prose.
 */

export type AppliedRule = {
  rule: Rule;
  why: string;
  caveat?: string;
};

export type ComputedDeadline = {
  rule_id: string;
  label: string;
  due: ISODate | null;
  days_left: number | null;
  status: DeadlineStatus | "pending";
  anchor: ISODate | null;
  anchor_label: string;
  pending_reason?: string;
  letter_stated?: ISODate;
  discrepancy?: "letter_shorter" | "letter_longer";
};

export type RightsResult = {
  route: "federal_only" | "state_overlay";
  rules: AppliedRule[];
  deadlines: ComputedDeadline[];
  help: HelpResource[];
  unsupported_note?: string;
};

const ANCHOR_LABEL: Record<DeadlineAnchor, string> = {
  letter_date: "date of the denial letter",
  final_internal_denial_date: "date of the plan's final internal appeal decision",
  service_date: "date of service",
};

const UNKNOWN_FUNDING_CAVEAT =
  "This depends on whether your employer plan is self-funded. Ask HR or check your Summary Plan Description.";
const UNKNOWN_EMERGENCY_CAVEAT =
  "This depends on whether the care was an emergency. Both possibilities are shown until you know.";

type Applicability = { applies: false } | { applies: true; caveat?: string };

export function ruleApplies(rule: Rule, s: Situation): Applicability {
  const a = rule.applies_if;
  const caveats: string[] = [];

  if (a.state && !a.state.includes(s.state)) return { applies: false };
  if (a.plan_source && !a.plan_source.includes(s.plan_source)) return { applies: false };

  if (a.self_funded && a.self_funded !== "any") {
    if (s.self_funded === "unknown") caveats.push(rule.caveat ?? UNKNOWN_FUNDING_CAVEAT);
    else if (s.self_funded !== a.self_funded) return { applies: false };
  }

  if (a.denial_category) {
    const cat = s.extraction.denial_category.value ?? "other";
    if (!a.denial_category.includes(cat)) return { applies: false };
  }

  if (a.emergency !== undefined) {
    if (s.emergency === "unknown") caveats.push(UNKNOWN_EMERGENCY_CAVEAT);
    else if ((s.emergency === "yes") !== a.emergency) return { applies: false };
  }

  if (a.urgent !== undefined && (s.urgent === "yes") !== a.urgent) return { applies: false };

  if (a.document_type) {
    const dt = s.extraction.document_type.value;
    if (!dt || !a.document_type.includes(dt)) return { applies: false };
  }

  // A dataset caveat on a funding-specific rule only matters while funding is unknown.
  const fundingSpecific = a.self_funded !== undefined && a.self_funded !== "any";
  const caveat = caveats[0] ?? (fundingSpecific ? undefined : rule.caveat);
  return caveat ? { applies: true, caveat } : { applies: true };
}

function renderWhy(rule: Rule, s: Situation): string {
  const cat = s.extraction.denial_category.value ?? "other";
  return rule.why_template
    .replaceAll("{state}", s.state)
    .replaceAll("{plan_source}", s.plan_source)
    .replaceAll("{denial_category}", DENIAL_CATEGORY_LABEL[cat].toLowerCase());
}

function resolveAnchor(rule: Rule, s: Situation): ISODate | null {
  switch (rule.deadline!.anchor) {
    case "letter_date":
      return s.anchor_dates.letter_date;
    case "final_internal_denial_date":
      return s.anchor_dates.final_internal_denial_date ?? null;
    case "service_date":
      return s.extraction.service_dates.value?.[0] ?? null;
  }
}

function letterStatedDue(s: Situation): ISODate | null {
  const stated = s.extraction.stated_appeal_deadline.value;
  if (!stated) return null;
  if (stated.kind === "date") return stated.date;
  return computeDue(s.anchor_dates.letter_date, {
    anchor: "letter_date",
    amount: stated.days,
    unit: "days",
    who: "consumer",
  });
}

function computeDeadline(rule: Rule, s: Situation): ComputedDeadline {
  const d = rule.deadline!;
  const anchor = resolveAnchor(rule, s);
  const base: ComputedDeadline = {
    rule_id: rule.id,
    label: rule.title,
    due: null,
    days_left: null,
    status: "pending",
    anchor,
    anchor_label: ANCHOR_LABEL[d.anchor],
  };
  if (!anchor) {
    return {
      ...base,
      pending_reason:
        d.anchor === "final_internal_denial_date"
          ? "This clock starts when you receive the plan's final decision on your internal appeal."
          : "This clock needs a date that was not found in your document.",
    };
  }

  let due = computeDue(anchor, d);
  let letter_stated: ISODate | undefined;
  let discrepancy: ComputedDeadline["discrepancy"];

  // Only the internal-appeal window is something a letter states directly.
  if (d.anchor === "letter_date" && rule.category === "deadline") {
    const stated = letterStatedDue(s);
    if (stated) {
      letter_stated = stated;
      const cmp = compareISO(stated, due);
      if (cmp < 0) discrepancy = "letter_shorter"; // keep the legal minimum, flag the letter
      else if (cmp > 0) {
        discrepancy = "letter_longer";
        due = stated; // the plan granted more time; use it
      }
    }
  }

  const days = daysLeft(due, s.today);
  return { ...base, due, days_left: days, status: statusFor(days), letter_stated, discrepancy };
}

export function computeRights(s: Situation, rules: Rule[], help: HelpResource[]): RightsResult {
  const supported = isSupportedState(s.state);

  const applied: AppliedRule[] = [];
  for (const rule of rules) {
    const r = ruleApplies(rule, s);
    if (!r.applies) continue;
    applied.push({ rule, why: renderWhy(rule, s), caveat: r.caveat });
  }
  applied.sort((x, y) => x.rule.priority - y.rule.priority || x.rule.id.localeCompare(y.rule.id));

  const deadlines = applied
    .filter(({ rule }) => rule.deadline?.who === "consumer")
    .map(({ rule }) => computeDeadline(rule, s))
    .sort((x, y) => {
      if (x.days_left === null && y.days_left === null) return 0;
      if (x.days_left === null) return 1;
      if (y.days_left === null) return -1;
      return x.days_left - y.days_left;
    });

  const helpFor = help.filter((h) => h.scope === "federal" || h.scope === s.state);
  // Put the most relevant human help first.
  const oon = s.extraction.denial_category.value === "out_of_network" || s.emergency === "yes";
  helpFor.sort((a, b) => score(b) - score(a));
  function score(h: HelpResource): number {
    let n = 0;
    if (h.scope === s.state) n += 4;
    if (h.kind === "CAP") n += 3;
    if (s.self_funded === "yes" && h.id === "fed.dol.ebsa") n += 10;
    if (oon && h.id === "fed.cms.no_surprises_help_desk") n += 6;
    return n;
  }

  return {
    route: supported ? "state_overlay" : "federal_only",
    rules: applied,
    deadlines,
    help: helpFor,
    unsupported_note: supported
      ? undefined
      : `Overturn does not yet include ${s.state}-specific rules. The federal protections above apply everywhere; your state insurance regulator can tell you about additional state rights.`,
  };
}
