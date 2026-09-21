# Speech templates — executable contract (T008)

Three pure modules under `lib/voice/`: `spoken.ts` (formats), `readback.ts` (what the assistant
reads back before relying on anything), `rights-speech.ts` (deadlines and protections spoken from
the engine's `RightsResult`). No model anywhere: what is spoken is what was extracted and what the
rules dataset says (FR-003, FR-007, FR-013). Limits: read-back ≤ 40 words ending in "Is that
right?"; rights chunks ≤ 120 words, one closing question; every protection names its source.

**Run on 2026-09-21 against the real engine (`lib/rules/engine.ts`, `lib/rules/load.ts`) and the
golden extractions** — the outputs below are what the code produced, and the golden transcripts
now carry them verbatim. All chunks ≤ 120 words with exactly one question; every protection's
`spoken` contains its `sourceName`; the five transcripts replay through `turn-check` with zero
violations.

## Sample outputs (today = 2026-10-21)

**Sample 02, CA prior auth, Marketplace** — read-back:
> Here's what I read: Pacific Crest Health Plan denied a laparoscopic cholecystectomy from September 4th, billed at eighteen thousand seven hundred fifty dollars, because prior authorization wasn't obtained. Is that right?

chunk 0:
> Here's where you stand. Your first deadline is March 10th, 2027 — 140 days from today — to file an internal appeal, under the federal ACA appeal rules. You generally start by filing a grievance with your plan. If the plan does not resolve it within 30 days, or you disagree with the answer, you can take it to the Department of Managed Health Care. That comes from California law. Want to hear more, or shall I draft the appeal letter?

**Sample 01, NY medical necessity, employer, funding unknown** — read-back:
> Here's what I read: Meridian Health Plan of New York denied an MRI of the left knee without contrast from August 20th, billed at two thousand four hundred dollars, saying it was not medically necessary. Is that right?

chunk 0:
> Here's where you stand. Your first deadline is March 7th, 2027 — 137 days from today — to file an internal appeal, under the federal ACA appeal rules. If your employer pays claims itself, state insurance laws generally do not apply. Your external review goes through the federal process, and the U.S. Department of Labor is the agency that helps with these plans. That comes from the federal ACA appeal rules. Want to hear more, or shall I draft the appeal letter?

**Sample 03, TX EOB, out-of-network emergency** — read-back (amount clause dropped to stay ≤ 40):
> Here's what I read: Lone Star Benefit Solutions didn't fully pay for an emergency department visit, level 4 and more from August 14th, because the provider was out of network. Is that right?

chunk 0 (No Surprises Act leads, as the dataset's priorities intend):
> Here's where you stand. Your first deadline is March 4th, 2027 — 134 days from today — to file an internal appeal, under the federal ACA appeal rules. For emergency services, the No Surprises Act says your plan must cover the care without prior authorization even if the hospital or doctor was out of network, your share of the cost cannot be higher than the in-network amount, and the provider cannot bill you for the difference. That comes from the No Surprises Act. Want to hear more, or shall I draft the appeal letter?

**Texas, no document, employer, funding unknown, approximate date** — chunk 0:
> Because the date is approximate, treat these as estimates. Your first deadline is around April 5th, 2027 — about 166 days — to file an internal appeal, under the federal ACA appeal rules. Want to hear more, or shall I draft the appeal letter?

chunk 1 (the first Texas protection, with its funding caveat):
> If your plan is insured rather than self-funded: If the plan denies your appeal because the care is not medically necessary or appropriate, or is experimental or investigational, you can ask for review by a TDI-certified Independent Review Organization using form LHL009, sent to the plan or its review agent. If your condition is life-threatening, you can request IRO review right after the first denial without waiting for the internal appeal. That comes from the Texas Department of Insurance. Want to hear more, or shall I draft the appeal letter?

Help line, sample 01: *If you'd like a person to look at it, Community Health Advocates is free help for exactly this; the number is in the email.*

## Design decisions the run settled

| Decision | Why |
|---|---|
| Services are spoken in the document's words, CPT/HCPCS codes stripped, acronyms kept ("an MRI of the left knee without contrast", "a laparoscopic cholecystectomy") | A template cannot translate medical terms without a model; verbatim is the safer read-back. The letter and summary keep the full description. |
| Chunk 0 = first dated deadline + non-deadline protections in engine order; "after the final decision" clocks and other dated deadlines come later | The first thing heard is what to do now. Engine order (priority) would otherwise put three pending clocks before any right. |
| Caveats become a short lead-in ("If your plan is insured rather than self-funded:") chosen from `applies_if.self_funded`, and are dropped when the summary already states the condition | The engine's caveat text is written for the screen; spoken, it doubled the sentence. |
| Summaries are cut to two sentences, parentheticals removed, "U.S." protected from the sentence splitter | ≤ 120-word chunks and TTS-friendly text. |
| EOB read-back says "didn't fully pay for … leaving you X to pay"; denial letters say "denied … billed at X" | Two document types, two truthful verbs. |
| The amount clause is the first thing dropped when a read-back exceeds 40 words | The amount is in the letter; the reason and the date are what the person must confirm. |
| Help line: "name is free help for exactly this" for CAPs, "is free" otherwise; the number is never spoken | Voice-design §8. |

## `lib/voice/spoken.ts`

```ts
/** Spoken formats (voice-design §8). Pure, dependency-free. */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${numberToWords(-n)}`;
  if (n < 20) return ONES[n] || "zero";
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberToWords(n % 100)}` : ""}`;
  if (n < 1_000_000) return `${numberToWords(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${numberToWords(n % 1000)}` : ""}`;
  return `${numberToWords(Math.floor(n / 1_000_000))} million${n % 1_000_000 ? ` ${numberToWords(n % 1_000_000)}` : ""}`;
}

/** $18,750 → "eighteen thousand seven hundred fifty dollars"; $45.60 → "forty-five dollars and sixty cents" (cents only under $100). */
export function spokenMoney(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const d = dollars === 1 ? "one dollar" : `${numberToWords(dollars)} dollars`;
  if (dollars < 100 && cents > 0) return `${d} and ${numberToWords(cents)} cents`;
  return d;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (d: number) => `${d}${d % 100 >= 11 && d % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][d % 10] ?? "th"}`;

/** 2026-09-04 with today in 2026 → "September 4th"; 2027-03-10 → "March 10th, 2027". */
export function spokenDate(iso: string, today: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ty = Number(today.slice(0, 4));
  return `${MONTHS[m - 1]} ${ordinal(d)}${y === ty ? "" : `, ${y}`}`;
}

/** "w•••@gmail.com" style for text; "w-dot-gmail-dot-com" style for speech. */
export function maskEmail(email: string): { text: string; spoken: string } {
  const [local, domain = ""] = email.split("@");
  const first = local.charAt(0) || "•";
  return { text: `${first}•••@${domain}`, spoken: `${first}-dot-${domain.replace(/\./g, "-dot-")}` };
}

export const countWords = (s: string) => s.replace(/\s+/g, " ").trim().split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** First n sentences of a text. */
const ABBREV = /\b(U\.S|e\.g|i\.e|Dr|Mr|Mrs|Ms|No|vs|etc|Inc|St)\./g;
export function firstSentences(text: string, n: number): string {
  const guarded = text.replace(/\s+/g, " ").trim().replace(ABBREV, (m) => m.replace(/\./g, "\u0000"));
  const s = guarded.match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g) ?? [guarded];
  return s.slice(0, n).map((x) => x.trim().replace(/\u0000/g, ".")).join(" ");
}

/** Remove parentheticals for speech: "a grievance (appeal) with" → "a grievance with". */
export function forSpeech(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, "").replace(/\s+([,.;:])/g, "$1").replace(/\s+/g, " ").trim();
}
```

## `lib/voice/readback.ts`

```ts
/**
 * Templated spoken read-backs. Pure. Never calls a model: what is spoken is what was extracted.
 * Limits: a document read-back is ≤ 40 words and ends with "Is that right?" (FR-003, voice-design §1).
 */
import type { Extraction } from "@/lib/schemas/extraction";
import type { DenialCategory } from "@/lib/schemas/core";
import { spokenDate, spokenMoney, countWords } from "./spoken";

export type ReadbackField = "insurer" | "service" | "date" | "amount" | "reason";

export type Readback = {
  spoken: string;
  fields: Partial<Record<ReadbackField, string>>;
  /** True when the read-back had to drop the amount clause to stay ≤ 40 words. */
  trimmed: boolean;
};

const REASON_CLAUSE: Record<DenialCategory, string> = {
  medical_necessity: "saying it was not medically necessary",
  prior_auth: "because prior authorization wasn't obtained",
  out_of_network: "because the provider was out of network",
  not_covered: "saying it isn't a covered benefit",
  coding_admin: "citing a coding or paperwork problem",
  experimental: "calling it experimental or investigational",
  timely_filing: "because the claim was filed too late",
  duplicate: "calling it a duplicate claim",
  other: "for the reason given on the letter",
};

/** "Laparoscopic cholecystectomy (CPT 47562)" → "laparoscopic cholecystectomy"; two services → first + "and more". */
export function spokenService(desc: string | null): string {
  if (!desc) return "a service";
  const parts = desc.split(/;\s*/).map((p) => p.replace(/\s*\((?:CPT|HCPCS|ICD)[^)]*\)/gi, "").trim()).filter(Boolean);
  const first = parts[0] ?? "a service";
  const acronym = /^[A-Z]{2,}\b/.test(first);
  const lower = acronym ? first : first.charAt(0).toLowerCase() + first.slice(1);
  // "an" before a vowel, or before an acronym whose letter name starts with a vowel sound (F, H, L, M, N, R, S, X)
  const article = acronym ? (/^[AEFHILMNORSX]/.test(lower) ? "an" : "a") : (/^[aeiou]/i.test(lower) ? "an" : "a");
  return parts.length > 1 ? `${article} ${lower} and more` : `${article} ${lower}`;
}

export function documentReadback(ex: Extraction, today: string): Readback {
  const insurer = ex.insurer_name.value ?? "The plan";
  const service = spokenService(ex.service_description.value);
  const date = ex.service_dates.value?.[0] ? spokenDate(ex.service_dates.value[0], today) : null;
  const billed = ex.amounts.billed.value;
  const owed = ex.amounts.patient_responsibility.value;
  const cat = ex.denial_category.value ?? "other";
  const reason = REASON_CLAUSE[cat];
  const isEob = ex.document_type.value === "eob";

  const fields: Readback["fields"] = { insurer, service: service.replace(/^an? /, ""), reason: reason };
  if (date) fields.date = date;
  if (billed != null) fields.amount = spokenMoney(billed);

  const build = (withAmount: boolean) => {
    const when = date ? ` from ${date}` : "";
    let amount = "";
    if (withAmount) {
      if (isEob && owed != null) amount = `, leaving you ${spokenMoney(owed)} to pay`;
      else if (billed != null) amount = `, billed at ${spokenMoney(billed)}`;
    }
    const verb = isEob ? "didn't fully pay for" : "denied";
    return `Here's what I read: ${insurer} ${verb} ${service}${when}${amount}, ${reason}. Is that right?`;
  };

  let spoken = build(true);
  let trimmed = false;
  if (countWords(spoken) > 40) { spoken = build(false); trimmed = true; }
  return { spoken, fields, trimmed };
}

/** No-document path: read back the spoken answers before computing rights. */
export function answersReadback(a: { state: string; plan_source: string; denial_category: DenialCategory; approxDate: string | null }, today: string): Readback {
  const src = { employer: "coverage through your employer", marketplace: "coverage through the Marketplace", direct: "coverage bought directly", other: "other coverage" }[a.plan_source] ?? a.plan_source;
  const why = REASON_CLAUSE[a.denial_category].replace(/^(saying|because|calling|citing|for) /, "");
  const when = a.approxDate ? `, letter around ${spokenDate(a.approxDate, today)}` : "";
  const spoken = `So far: ${a.state}, ${src}, denied ${REASON_CLAUSE[a.denial_category]}${when}. Is that right?`;
  void why;
  return { spoken, fields: { reason: REASON_CLAUSE[a.denial_category] }, trimmed: false };
}

/** Re-read exactly one corrected field. */
export function fieldReadback(field: ReadbackField, value: string, note?: string): string {
  const lead: Record<ReadbackField, string> = {
    insurer: `The insurer is ${value}.`,
    service: `The service is ${value}.`,
    date: `The date is ${value}.`,
    amount: `The amount is ${value}.`,
    reason: `The reason is ${value}.`,
  };
  return `${lead[field]}${note ? ` ${note}` : ""} The rest stays as I read it. Better?`;
}

/** Spoken confirmation of one answer, folded into the next question by the caller. */
export function answerEcho(field: string, value: string): string {
  const echo: Record<string, string> = {
    state: value,
    plan_source: { employer: "Through your employer", marketplace: "Through the Marketplace", direct: "Bought directly", other: "Other coverage" }[value] ?? value,
    self_funded: { yes: "Self-funded", no: "Insured", unknown: "That's fine" }[value] ?? value,
    emergency: { yes: "An emergency", no: "Not an emergency", unknown: "That's fine" }[value] ?? value,
    urgent: { yes: "Urgent", no: "Not urgent" }[value] ?? value,
  };
  return `${echo[field] ?? value}.`;
}
```

## `lib/voice/rights-speech.ts`

```ts
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
```

## `tests/voice/speech.test.ts` (to write at T008 — assertions the run already satisfied)

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { computeRights } from "@/lib/rules/engine";
import { buildSituation } from "@/lib/situation";
import { documentReadback, answersReadback, fieldReadback, spokenService } from "@/lib/voice/readback";
import { spokenRights, sourceName, CHUNK_MAX_WORDS } from "@/lib/voice/rights-speech";
import { spokenMoney, spokenDate, numberToWords, maskEmail, countWords, firstSentences } from "@/lib/voice/spoken";
import { checkTurn } from "@/lib/voice/turn-check";

const TODAY = "2026-10-21";
const ex = (id: string) => Extraction.parse(JSON.parse(readFileSync(`data/samples/${id}.extraction.json`, "utf8")));
const SAMPLES: [string, any][] = [
  ["01-medical-necessity-ny", { state: "NY", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }],
  ["02-prior-auth-ca", { state: "CA", plan_source: "marketplace", self_funded: "no", emergency: "no", urgent: "no" }],
  ["03-oon-emergency-tx-eob", { state: "TX", plan_source: "employer", self_funded: "unknown", emergency: "yes", urgent: "no" }],
  ["04-not-covered-fl", { state: "FL", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }],
  ["05-coding-error-ny-eob", { state: "NY", plan_source: "employer", self_funded: "no", emergency: "no", urgent: "no" }],
  ["07-experimental-ca-photo", { state: "CA", plan_source: "direct", self_funded: "no", emergency: "no", urgent: "yes" }],
];

describe("formats", () => {
  it("money in words", () => {
    expect(spokenMoney(18750)).toBe("eighteen thousand seven hundred fifty dollars");
    expect(spokenMoney(45.6)).toBe("forty-five dollars and sixty cents");
    expect(spokenMoney(3478.4)).toBe("three thousand four hundred seventy-eight dollars");
    expect(numberToWords(1_250_000)).toBe("one million two hundred fifty thousand");
  });
  it("dates with ordinal, year only when not this year", () => {
    expect(spokenDate("2026-09-04", TODAY)).toBe("September 4th");
    expect(spokenDate("2027-03-10", TODAY)).toBe("March 10th, 2027");
    expect(spokenDate("2026-10-21", TODAY)).toBe("October 21st");
  });
  it("masks emails for text and speech", () =>
    expect(maskEmail("walter.demo@gmail.com")).toEqual({ text: "w•••@gmail.com", spoken: "w-dot-gmail-dot-com" }));
  it("keeps U.S. inside one sentence", () =>
    expect(firstSentences("Goes to the U.S. Department of Labor. Next.", 1)).toBe("Goes to the U.S. Department of Labor."));
  it("speaks services without codes, acronyms intact", () => {
    expect(spokenService("Laparoscopic cholecystectomy (CPT 47562)")).toBe("a laparoscopic cholecystectomy");
    expect(spokenService("MRI of the left knee without contrast (CPT 73721)")).toBe("an MRI of the left knee without contrast");
    expect(spokenService("Emergency department visit, level 4 (CPT 99284); CT abdomen (CPT 74176)")).toBe("an emergency department visit, level 4 and more");
  });
});

describe("read-backs", () => {
  for (const [id] of SAMPLES) it(`${id}: ≤ 40 words, ends with the question, names the insurer`, () => {
    const e = ex(id);
    const rb = documentReadback(e, TODAY);
    expect(countWords(rb.spoken)).toBeLessThanOrEqual(40);
    expect(rb.spoken.endsWith("Is that right?")).toBe(true);
    expect(rb.spoken).toContain(e.insurer_name.value!);
    expect(checkTurn(rb.spoken, { kind: "readback_only" }).ok).toBe(true);
  });
  it("answers read-back for the no-document path", () => {
    const rb = answersReadback({ state: "Texas", plan_source: "employer", denial_category: "prior_auth", approxDate: "2026-10-07" }, TODAY);
    expect(rb.spoken).toBe("So far: Texas, coverage through your employer, denied because prior authorization wasn't obtained, letter around October 7th. Is that right?");
  });
  it("single-field re-read", () =>
    expect(fieldReadback("date", "September 2nd, 2026")).toBe("The date is September 2nd, 2026. The rest stays as I read it. Better?"));
});

describe("rights speech", () => {
  for (const [id, answers] of SAMPLES) it(`${id}: chunks ≤ ${CHUNK_MAX_WORDS} words, one question, every protection sourced`, () => {
    const s = buildSituation(ex(id), answers, TODAY)!;
    const r = computeRights(s, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY });
    expect(sp.chunks.length).toBeGreaterThan(0);
    for (const c of sp.chunks) {
      expect(countWords(c)).toBeLessThanOrEqual(CHUNK_MAX_WORDS);
      expect((c.match(/\?/g) ?? []).length).toBe(1);
      expect(checkTurn(c, { kind: "rights_chunk" }).violations).toEqual([]);
    }
    for (const p of sp.protections) {
      expect(p.spoken).toContain(p.sourceName);
      expect(p.sourceUrl).toMatch(/^https:\/\//);
      expect(p.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    if (sp.firstDeadline) {
      expect(sp.firstDeadline.spoken).toMatch(/\d+ days/);
      expect(sp.firstDeadline.spoken).toContain(sp.firstDeadline.sourceName);
      expect(sp.chunks[0]).toContain(sp.firstDeadline.spoken);
    }
    expect(sp.chunks.at(-1)).toMatch(/That's everything that applies\. Shall I draft the appeal letter\?$/);
    // same engine, same facts → same rights: spoken ids are exactly the applied rule ids
    const spokenIds = new Set([...(sp.firstDeadline ? [sp.firstDeadline.ruleId] : []), ...sp.protections.map((p) => p.id)]);
    expect(spokenIds).toEqual(new Set(r.rules.map((a) => a.rule.id)));
  });
  it("sample 02: March 10th 2027, 140 days, ACA rules, CA grievance first, no NSA", () => {
    const r = computeRights(buildSituation(ex("02-prior-auth-ca"), SAMPLES[1][1], TODAY)!, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY });
    expect(sp.firstDeadline).toMatchObject({ date: "2027-03-10", daysRemaining: 140, ruleId: "fed.internal_appeal.filing_window", sourceName: "the federal ACA appeal rules" });
    expect(sp.chunks[0]).toContain("Department of Managed Health Care");
    expect(sp.protections.map((p) => p.id)).not.toContain("nsa.emergency.no_balance_billing");
  });
  it("approximate path says so and uses 'around' / 'about'", () => {
    const e = Extraction.parse({ ...ex("02-prior-auth-ca"),
      letter_date: { value: "2026-10-07", confidence: 0.5, quote: null, page: null },
      stated_appeal_deadline: { value: null, confidence: 0, quote: null, page: null } });
    const r = computeRights(buildSituation(e, { state: "TX", plan_source: "employer", self_funded: "unknown", emergency: "no", urgent: "no" }, TODAY)!, ALL_RULES, HELP_RESOURCES);
    const sp = spokenRights(r, { today: TODAY, approximate: true });
    expect(sp.chunks[0]).toMatch(/^Because the date is approximate/);
    expect(sp.firstDeadline?.spoken).toMatch(/around April 5th, 2027 — about 166 days/);
  });
  it("every rule in the dataset gets a named source", () => {
    for (const rule of ALL_RULES) expect(sourceName(rule)).not.toMatch(/^(federal|nsa|CA|NY|TX) law$/);
  });
});
```

## Golden transcripts

`docs/transcripts/*.md` now carry these outputs verbatim for T3/T8 (sample 02 and cancel), T3/T12/T13
(sample 01) and T8 (Texas). `tests/voice/golden.test.ts` (T027) regenerates them from the templates
and diffs, so a template change that alters what is spoken is a visible, reviewed change.
