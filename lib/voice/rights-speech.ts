/**
 * Spoken rights: deterministic templates over the engine's RightsResult. Pure.
 * Deadlines and protections are never rephrased by a model (FR-013); every spoken item names
 * its source (FR-007); chunks are ≤ 120 words and end with one question (FR-001/002).
 */
import type { RightsResult, ComputedDeadline, AppliedRule } from "@/lib/rules/engine";
import type { Rule, HelpResource } from "@/lib/rules/schema";
import { spokenDate, countWords, firstSentences, forSpeech } from "./spoken";

export type SpokenDeadline = {
  ruleId: string; date: string | null; daysRemaining: number | null; anchorDate: string | null; anchorLabel: string;
  approximate: boolean; pending: boolean; sourceName: string; sourceUrl: string; legalRef: string; lastVerified: string; spoken: string;
};
export type SpokenProtection = {
  id: string; spoken: string; sourceName: string; sourceUrl: string; legalRef: string; lastVerified: string; whyApplies: string; caveat?: string;
};
export type SpokenHelp = { id: string; name: string; phone?: string; url: string; spoken: string };

export type SpokenRightsSummary = {
  firstDeadline: SpokenDeadline | null;
  otherDeadlines: SpokenDeadline[];
  protections: SpokenProtection[];
  humanHelp: SpokenHelp | null;
  chunks: string[];
  approximate: boolean;
};

export const CHUNK_MAX_WORDS = 120;
const PROTECTIONS_PER_CHUNK = 3;
const CLOSING_MORE = "Want to hear more, or shall I draft the appeal letter?";
const CLOSING_LAST = "That's everything that applies. Shall I draft the appeal letter?";

/** Short spoken name of a rule's source, from jurisdiction and legal reference. Links stay in writing. */
export function sourceName(rule: Rule): string {
  const ref = rule.legal_ref;
  if (rule.jurisdiction === "nsa" || /45 CFR 149|No Surprises/i.test(ref)) return "the No Surprises Act";
  if (rule.jurisdiction === "federal") return /29 U\.S\.C\.|ERISA/i.test(ref) && !/CFR 147/.test(ref) ? "the federal ERISA rules" : "the federal ACA appeal rules";
  if (rule.jurisdiction === "CA") return /DMHC/i.test(ref) ? "California's Department of Managed Health Care" : "California law";
  if (rule.jurisdiction === "NY") return /DFS/i.test(ref) ? "New York's Department of Financial Services" : "New York insurance law";
  if (rule.jurisdiction === "TX") return /TDI|Texas Department of Insurance/i.test(ref) ? "the Texas Department of Insurance" : "Texas insurance law";
  return `${rule.jurisdiction} law`;
}

/** "You have at least 180 days to file an internal appeal" → "file an internal appeal". */
function actionFromTitle(rule: Rule): string {
  const t = rule.title.replace(/^[A-Z][a-z]+ [A-Za-z]*:\s*/, "");             // strip "New York: " / "Texas: "
  const m = t.match(/\bto (.+)$/i);
  if (m) return m[1].replace(/\.$/, "");
  return t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, "");
}

function ruleById(r: RightsResult, id: string): AppliedRule | undefined {
  return r.rules.find((a) => a.rule.id === id);
}

export function spokenDeadline(d: ComputedDeadline, r: RightsResult, today: string, approximate: boolean): SpokenDeadline {
  const applied = ruleById(r, d.rule_id)!;
  const rule = applied.rule;
  const src = sourceName(rule);
  const base = { ruleId: d.rule_id, anchorDate: d.anchor, anchorLabel: d.anchor_label, approximate, sourceName: src,
    sourceUrl: rule.source_url, legalRef: rule.legal_ref, lastVerified: rule.last_verified };
  if (!d.due || d.days_left == null) {
    return { ...base, date: null, daysRemaining: null, pending: true,
      spoken: `After the plan's final decision on your appeal, you'll have ${rule.deadline!.amount} ${rule.deadline!.unit} to ${actionFromTitle(rule)}, under ${src}.` };
  }
  const when = approximate ? `around ${spokenDate(d.due, today)} — about ${d.days_left} days` : `${spokenDate(d.due, today)} — ${d.days_left} days from today`;
  const passed = d.days_left < 0 ? ` That date has passed; the letter may still be worth sending, and the free help below can say what applies now.` : "";
  const discrepancy = d.discrepancy === "letter_shorter" ? ` Your letter states a shorter deadline than the law's minimum; both are in the email.` : "";
  return { ...base, date: d.due, daysRemaining: d.days_left, pending: false,
    spoken: `Your first deadline is ${when} — to ${actionFromTitle(rule)}, under ${src}.${passed}${discrepancy}` };
}

export function spokenProtection(a: AppliedRule): SpokenProtection {
  const src = sourceName(a.rule);
  const body = forSpeech(firstSentences(a.rule.summary, 2));
  // A summary that already opens with its own condition ("If your employer pays claims itself…") needs no lead-in.
  const caveat = a.caveat && !/self-funded|insured|pays claims itself/i.test(firstSentences(body, 1)) ? `${caveatLead(a.caveat, a.rule)} ` : "";
  return { id: a.rule.id, sourceName: src, sourceUrl: a.rule.source_url, legalRef: a.rule.legal_ref, lastVerified: a.rule.last_verified,
    whyApplies: a.why, caveat: a.caveat, spoken: `${caveat}${body} That comes from ${src}.` };
}

/** Turn an engine caveat into a short spoken lead-in. */
function caveatLead(c: string, rule: Rule): string {
  if (/self-funded|insured/i.test(c)) {
    return rule.applies_if.self_funded === "yes" ? "If your plan is self-funded:" : "If your plan is insured rather than self-funded:";
  }
  if (/emergency/i.test(c)) return "If the care was an emergency:";
  return `${firstSentences(c, 1)}`;
}

export function spokenHelp(h: HelpResource | undefined): SpokenHelp | null {
  if (!h) return null;
  const free = h.kind === "CAP" ? "is free help for exactly this" : "is free";
  return { id: h.id, name: h.name, phone: h.phone, url: h.url, spoken: `If you'd like a person to look at it, ${h.name} ${free}; the number is in the email.` };
}

export function spokenRights(r: RightsResult, opts: { today: string; approximate?: boolean }): SpokenRightsSummary {
  const approximate = !!opts.approximate;
  const deadlines = r.deadlines.map((d) => spokenDeadline(d, r, opts.today, approximate));
  const dated = deadlines.filter((d) => !d.pending);
  const pending = deadlines.filter((d) => d.pending);
  const firstDeadline = dated[0] ?? null;
  const otherDeadlines = [...dated.slice(1), ...pending];

  // Protections = every applied rule that is not the spoken first deadline; pending deadline rules are spoken as protections.
  const spokenIds = new Set(firstDeadline ? [firstDeadline.ruleId] : []);
  const protections = r.rules.filter((a) => !spokenIds.has(a.rule.id) && !(a.rule.deadline?.who === "consumer" && dated.some((d) => d.ruleId === a.rule.id && d !== firstDeadline)))
    .map((a) => {
      const pend = pending.find((p) => p.ruleId === a.rule.id);
      return pend ? { ...spokenProtection(a), spoken: pend.spoken } : spokenProtection(a);
    });
  const others = dated.slice(1).map((d) => ({ ...spokenProtection(ruleById(r, d.ruleId)!), spoken: d.spoken.replace(/^Your first deadline/, "Another deadline") }));
  // Chunk 0 carries the first deadline plus the most useful *non-deadline* protections; "after the final decision"
  // clocks and other dated deadlines come after, so the first thing heard is what to do now.
  const isDeadlineRule = (p: SpokenProtection) => r.rules.find((a) => a.rule.id === p.id)?.rule.category === "deadline";
  const ordered = [...protections.filter((p) => !isDeadlineRule(p)), ...others, ...protections.filter(isDeadlineRule)];

  // Chunking: intro + first deadline + up to 3 protections, ≤ 120 words each, one closing question.
  const chunks: string[] = [];
  const intro = approximate ? "Because the date is approximate, treat these as estimates." : "Here's where you stand.";
  let current: string[] = [intro];
  if (firstDeadline) current.push(firstDeadline.spoken);
  else if (r.deadlines.length === 0) current.push("I don't have a dated deadline for this situation; the email will say why.");
  let n = 0;
  const flush = (last: boolean) => { chunks.push([...current, last ? CLOSING_LAST : CLOSING_MORE].join(" ")); current = []; n = 0; };
  ordered.forEach((p, i) => {
    const candidate = [...current, p.spoken, CLOSING_MORE].join(" ");
    if (n >= PROTECTIONS_PER_CHUNK || countWords(candidate) > CHUNK_MAX_WORDS) flush(false);
    current.push(p.spoken); n++;
    if (i === ordered.length - 1) flush(true);
  });
  if (current.length) flush(true);

  return { firstDeadline, otherDeadlines, protections: ordered, humanHelp: spokenHelp(r.help[0]), chunks, approximate };
}
