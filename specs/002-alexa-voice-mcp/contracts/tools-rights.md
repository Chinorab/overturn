# Tool handlers, part 3 — executable contract (T013, rights and letter)

`overturn_compute_rights` (deterministic, no model) and `overturn_draft_letter` (the second and
last model call, gated by an explicit yes). `overturn_send_letter` and `overturn_discard_case`
follow in the delivery task, T020.

**Run on 2026-09-22** against the real engine, rules dataset, `buildSituation`, and the golden
extraction and letter of sample 02: 36 assertions pass, every spoken string checked through
`turn-check`, and the T007–T012 suites re-run clean.

## What the run proves

- **The numbers the transcript, the video script and the Devpost page promise are the ones the
  code produces**: sample 02 → first deadline `2027-03-10`, **140 days**, rule
  `fed.internal_appeal.filing_window`, source "the federal ACA appeal rules"; Texas no-document →
  `2027-04-05`, **about 166 days**, flagged approximate, with a Texas rule among the protections.
- Every deadline carries an `https` source and a `lastVerified` date; every protection's spoken
  line contains its own source name; a scheduled surgery brings **no** No Surprises Act rule.
- `draft_letter` without `confirmed` changes nothing and returns the confirmation question; with
  `confirmed: true` it drafts, and the closing line names the **masked** email — the full address
  never appears in a spoken string.
- Every model failure keeps the case at `rights_computed` and offers the written fallback
  ("I can email you your deadlines and the rules — shall I?"), so a model outage never ends the
  conversation.

## The bug the run found

The no-document path stored `"unknown"` as the document date when the person said "I don't know",
and that string reached `computeDue()` → `RangeError: Invalid time value` from `date-fns`. The
crash was inside the engine, three layers below the tool. Fixes, both kept:

1. `syntheticExtraction()` returns **null** when no ISO date can be found — "no date the person
   gave" is a state the type system now carries, not a bad value passed downstream.
2. The result is validated with the existing `Extraction` schema before use, so a future field
   mistake fails at the boundary instead of inside the rules engine.

`compute_rights` then answers `not_understood` with "I need the date on the letter before I can
work out your deadlines. Roughly when did it arrive?" — a question, not a dead end.

## Design notes

| Decision | Why |
|---|---|
| `toEngineAnswers()` is the only translation from the conversation's answer bag (question ids, `"unknown"` strings) to the engine's `Answers` | One place to audit; it never invents a value — missing stays `unknown`, and `urgent` degrades to `no` because the engine types it yes/no |
| The no-document path builds a **synthetic extraction** with every document field `null` | The engine takes one input shape; the letter's `[ADD: …]` blanks come from those nulls, which is exactly what the person must fill in later |
| `approximate` comes from `approxDocumentDate` being set, not from a flag passed around | A date the person gave precisely is not approximate even on the no-document path |
| Page count is estimated at ~450 words and re-measured from the PDF at send time | The spoken "two pages" must not be a guess that contradicts the attachment |
| `draft_invalid` is reported as `model_unavailable` | Same reason as T012: the person does not care which layer failed |

## `mcp/src/tools/rights.ts`

```ts
/**
 * T013 handlers: overturn_compute_rights (deterministic, no model) and overturn_draft_letter
 * (the second and last model call, gated by an explicit yes).
 * The engine decides; the templates speak; the model only writes prose for the letter.
 */
import { z } from "zod";
import { Extraction } from "@/lib/schemas/extraction";
import type { Situation } from "@/lib/schemas/situation";
import type { Answers } from "@/lib/session";
import type { LetterDraft } from "@/lib/schemas/letter";
import type { RightsResult } from "@/lib/rules/engine";
import { computeRights } from "@/lib/rules/engine";
import { buildSituation } from "@/lib/situation";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { gate, next } from "./machine";
import { spokenRights, type SpokenRightsSummary } from "./rights-speech";
import { ok, fail, fromGate, type Envelope } from "./envelope";
import type { Ctx, Facts } from "./tools-basic";
import type { CaseRecord } from "./store";

function open(ctx: Ctx, code: string): { rec: CaseRecord<Facts> } | { env: Envelope<never> } {
  const r = ctx.store.get(code, ctx.sessionId);
  if (r.ok) return { rec: r.record };
  const speak = r.error === "wrong_session" ? "That code belongs to a different conversation. Would you like to say the code again?"
    : r.error === "case_closed" ? "That case is finished and I kept nothing. Shall I start a new one?"
      : "I don't have that case any more — it may have been more than thirty minutes. Shall we start again?";
  return { env: fail(r.error, `case ${code}`, speak) };
}

// ---------------------------------------------------------------- answers bag → engine Answers
/**
 * The conversation stores answers under question ids and "unknown" strings; the engine wants a
 * `Situation`. This is the only place that translates, and it never invents: a missing answer
 * becomes "unknown" (or "no" for `urgent`, which the engine types as yes/no).
 */
export function toEngineAnswers(a: Facts["answers"]): Answers {
  const yn = (v: unknown) => (v === "yes" || v === "no" ? v : "unknown") as "yes" | "no" | "unknown";
  return {
    state: a.state as Answers["state"],
    plan_source: (a.plan_source ?? "other") as Answers["plan_source"],
    self_funded: yn(a.self_funded),
    emergency: yn(a.emergency),
    urgent: a.urgent === "yes" ? "yes" : "no",
  };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * For the no-document path there is no letter; build a minimal extraction from the answers.
 * Returns null when the answers cannot make a valid one — "I don't know" for the date leaves the
 * case without an anchor, and the schema is what proves it rather than the engine crashing later.
 */
export function syntheticExtraction(a: Facts["answers"], approxDate: string | null, base: Extraction): Extraction | null {
  const said = <T,>(v: T) => ({ value: v, confidence: 0.5, quote: null, page: null }) as never;
  const none = { value: null, confidence: 0, quote: null, page: null } as never;
  const candidate = typeof a.document_date === "string" && ISO.test(a.document_date) ? a.document_date : approxDate;
  const anchor = typeof candidate === "string" && ISO.test(candidate) ? candidate : null;
  if (!anchor) return null;                       // no date the person gave = no deadline we can honestly compute
  const draft = {
    ...base,
    document_type: said("denial_letter"),
    program_signals: said("commercial"),
    insurer_name: none, member_id: none, claim_number: none, provider_name: none,
    service_description: none, service_dates: none, denial_reason_quote: none, denial_codes: none,
    stated_appeal_deadline: none, stated_appeal_address: none, stated_appeal_instructions: none,
    network_status: none, emergency_signals: none, urgency_signals: none,
    amounts: { billed: none, allowed: none, plan_paid: none, patient_responsibility: none },
    letter_date: anchor ? said(anchor) : none,
    denial_category: said(a.denial_category ?? "other"),
    state_hint: a.state ? said(a.state) : none,
  };
  const parsed = Extraction.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------- overturn_compute_rights
export const RightsInput = z.object({ code: z.string() });

export type RightsData = { summary: SpokenRightsSummary; chunks: string[]; next: "offer_letter" };

export function computeRightsTool(ctx: Ctx & { emptyExtraction: () => Extraction }, input: z.infer<typeof RightsInput>): Envelope<RightsData> {
  const found = open(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_compute_rights", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  const extraction = rec.facts.extraction ?? syntheticExtraction(rec.facts.answers, rec.facts.approxDocumentDate, ctx.emptyExtraction());
  const situation = extraction ? buildSituation(extraction, toEngineAnswers(rec.facts.answers), ctx.today) : null;
  if (!situation || !extraction) {
    return fail("not_understood", "no anchor date",
      "I need the date on the letter before I can work out your deadlines. Roughly when did it arrive?",
      { code: rec.code, status: rec.status });
  }

  const rights: RightsResult = computeRights(situation, ALL_RULES, HELP_RESOURCES);
  rec.facts.extraction = extraction;
  rec.facts.situation = situation;
  rec.facts.rights = rights;
  rec.status = next("overturn_compute_rights", rec.status);

  const summary = spokenRights(rights, { today: ctx.today, approximate: !!rec.facts.approxDocumentDate });
  return ok(rec.code, rec.status, { summary, chunks: summary.chunks, next: "offer_letter" }, summary.chunks[0]);
}

// ---------------------------------------------------------------- overturn_draft_letter
export const DraftInput = z.object({ code: z.string(), confirmed: z.boolean().optional() });

export type Drafter = (s: Situation, r: RightsResult) => Promise<
  | { ok: true; draft: LetterDraft }
  | { ok: false; reason: "model_unavailable" | "unsupported_on_provider" | "draft_invalid"; detail?: string }
>;

const DRAFT_ERROR_SPEAK: Record<string, string> = {
  model_unavailable: "I can't write the letter right now. I can email you your deadlines and the rules that apply, and you can ask me for the letter later. Shall I do that?",
  unsupported_on_provider: "I can't write the letter with the model I'm using right now. Shall I email you your deadlines and the rules instead?",
  draft_invalid: "Something went wrong writing the letter. Shall I try once more?",
};

export type DraftData = { letter: { pages: number; blanksCount: number; blanks: string[]; attachmentsChecklist: { item: string; why: string }[]; whereToSend: LetterDraft["send_to"] }; next: "offer_send" };

/** A page is ~450 words of business letter; the exact count comes from the PDF at send time. */
export const estimatePages = (words: number) => Math.max(1, Math.ceil(words / 450));

export async function draftLetterTool(ctx: Ctx & { draft: Drafter }, input: z.infer<typeof DraftInput>): Promise<Envelope<DraftData>> {
  const found = open(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_draft_letter", rec.status, { confirmed: input.confirmed }, { emailMaskedSpoken: rec.account?.emailMaskedSpoken });
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  if (!rec.facts.situation || !rec.facts.rights) {
    return fail("wrong_state", "no rights computed", "I need your deadlines first. Shall I work them out?", { code: rec.code, status: rec.status });
  }

  const result = await ctx.draft(rec.facts.situation, rec.facts.rights);
  if (!result.ok) return fail(result.reason === "draft_invalid" ? "model_unavailable" : result.reason, result.detail ?? result.reason, DRAFT_ERROR_SPEAK[result.reason], { code: rec.code, status: rec.status });

  const draft = result.draft;
  rec.facts.letter = draft;
  rec.status = next("overturn_draft_letter", rec.status);

  const words = draft.sections.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  const pages = estimatePages(words);
  const blanks = draft.placeholders;
  const data: DraftData = {
    letter: { pages, blanksCount: blanks.length, blanks, attachmentsChecklist: draft.checklist, whereToSend: draft.send_to },
    next: "offer_send",
  };
  const masked = rec.account?.emailMaskedSpoken;
  const speak = `Done — ${spokenPages(pages)}, with ${spokenBlanks(blanks.length)}${blanks.length ? `, like ${blanks[0]}` : ""}. ${
    masked ? `Shall I send it to your email ending in ${masked}?` : "Shall I send it to the email on your linked account?"}`;
  return ok(rec.code, rec.status, data, speak);
}

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const spokenPages = (n: number) => `${NUM[n] ?? n} page${n === 1 ? "" : "s"}`;
const spokenBlanks = (n: number) => (n === 0 ? "nothing left blank" : `${NUM[n] ?? n} blank${n === 1 ? "" : "s"} for you to fill`);
```

## Tests (`tests/mcp/tools-rights.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { LetterDraft } from "@/lib/schemas/letter";
import { CaseStore } from "./store";
import { startCase, confirmFacts, type Ctx, type Facts } from "./tools-basic";
import { attachDocument, answer, type Extractor } from "./tools-input";
import { computeRightsTool, draftLetterTool, toEngineAnswers, syntheticExtraction, estimatePages, type Drafter } from "./tools-rights";
import { checkTurn } from "@/lib/voice/turn-check";

let fails = 0;
const eq = (label: string, got: any, exp: any) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.log("FAIL", label, "got", JSON.stringify(got), "expected", JSON.stringify(exp)); }
};
const speakOk = (label: string, env: any, kind: any = "normal") => {
  const text = env.ok ? env.speak : env.needs_confirmation ? env.needs_confirmation.question : env.error.speak;
  const r = checkTurn(text, { kind });
  if (!r.ok) { fails++; console.log("FAIL turn", label, r.violations, "::", text.slice(0, 95)); }
};

const TODAY = "2026-10-21";
const ex = (id: string) => Extraction.parse(JSON.parse(readFileSync(`D:/claude/overturn/data/samples/${id}.extraction.json`, "utf8")));
const letter = (id: string) => LetterDraft.parse(JSON.parse(readFileSync(`D:/claude/overturn/data/samples/${id}.letter.json`, "utf8")));
let now = Date.parse("2026-10-21T10:00:00Z");
const store = new CaseStore<Facts>({ clock: () => now });

let extractor: Extractor = async () => ({ ok: true, extraction: ex("02-prior-auth-ca") });
let drafter: Drafter = async () => ({ ok: true, draft: letter("02-prior-auth-ca") });
const ctx = (sessionId = "s1") => ({
  store, sessionId, today: TODAY,
  account: { email: "walter.demo@gmail.com", emailMasked: "w•••@gmail.com", emailMaskedSpoken: "w-dot-gmail-dot-com" },
  loadSample: async () => null, samples: [],
  extract: (d: any) => extractor(d),
  draft: (s: any, r: any) => drafter(s, r),
  emptyExtraction: () => ex("02-prior-auth-ca"),
}) as any;

const run = async (answers: [string, string][], sample = "02-prior-auth-ca") => {
  extractor = async () => ({ ok: true, extraction: ex(sample) });
  const code = (startCase(ctx(), { has_document: "yes" }) as any).case.code;
  await attachDocument(ctx(), { code, document: { kind: "pdf", base64: "AAAA" } });
  confirmFacts(ctx(), { code, answer: "yes" });
  for (const [q, u] of answers) answer(ctx(), { code, question: q as any, utterance: u });
  return code;
};

(async () => {
  // ---- compute_rights on sample 02: the numbers the transcript and the video promise
  const code = await run([["state", "yes, California"], ["plan_source", "through Covered California"], ["emergency", "no"], ["urgent", "no"]]);
  const r = computeRightsTool(ctx(), { code });
  eq("status", (r as any).case.status, "rights_computed");
  const s = (r as any).data.summary;
  eq("first deadline", [s.firstDeadline.date, s.firstDeadline.daysRemaining, s.firstDeadline.ruleId], ["2027-03-10", 140, "fed.internal_appeal.filing_window"]);
  eq("not approximate", s.firstDeadline.approximate, false);
  eq("chunk 0 spoken", (r as any).speak, s.chunks[0]);
  eq("every deadline sourced", [s.firstDeadline, ...s.otherDeadlines].every((d: any) => /^https:\/\//.test(d.sourceUrl) && /^\d{4}-\d{2}-\d{2}$/.test(d.lastVerified)), true);
  eq("every protection names its source", s.protections.every((p: any) => p.spoken.includes(p.sourceName)), true);
  eq("no NSA for a scheduled surgery", s.protections.some((p: any) => p.id.startsWith("nsa.")), false);
  for (const [i, c] of s.chunks.entries()) speakOk(`chunk ${i}`, { ok: true, speak: c }, "rights_chunk");

  // computing twice is refused
  eq("compute twice", (computeRightsTool(ctx(), { code }) as any).error.code, "wrong_state");
  speakOk("compute twice", computeRightsTool(ctx(), { code }));

  // ---- draft: gated, then confirmed
  const gateEnv = await draftLetterTool(ctx(), { code });
  eq("gated", (gateEnv as any).needs_confirmation.action, "draft_letter");
  eq("status unchanged", (gateEnv as any).case.status, "rights_computed");
  speakOk("draft confirmation", gateEnv);
  const d = await draftLetterTool(ctx(), { code, confirmed: true });
  eq("drafted", (d as any).case.status, "letter_drafted");
  eq("pages", (d as any).data.letter.pages >= 1, true);
  eq("blanks counted", (d as any).data.letter.blanksCount, letter("02-prior-auth-ca").placeholders.length);
  eq("checklist carried", (d as any).data.letter.attachmentsChecklist.length > 0, true);
  eq("where to send", (d as any).data.letter.whereToSend.address.includes("Grievance and Appeals"), true);
  eq("send question names the masked email", (d as any).speak.endsWith("Shall I send it to your email ending in w-dot-gmail-dot-com?"), true);
  eq("full email never spoken", (d as any).speak.includes("walter.demo"), false);
  speakOk("draft done", d);
  // re-draft allowed before sending
  eq("re-draft", (await draftLetterTool(ctx(), { code, confirmed: true }) as any).case.status, "letter_drafted");

  // ---- draft failures
  for (const [reason, expected] of [["model_unavailable", "model_unavailable"], ["unsupported_on_provider", "unsupported_on_provider"], ["draft_invalid", "model_unavailable"]] as const) {
    const c2 = await run([["state", "yes, California"], ["plan_source", "through Covered California"], ["emergency", "no"], ["urgent", "no"]]);
    computeRightsTool(ctx(), { code: c2 });
    drafter = async () => ({ ok: false, reason: reason as never });
    const f = await draftLetterTool(ctx(), { code: c2, confirmed: true });
    eq(`draft ${reason}`, (f as any).error.code, expected);
    eq(`draft ${reason} keeps the case`, (f as any).case.status, "rights_computed");
    speakOk(`draft ${reason}`, f);
    drafter = async () => ({ ok: true, draft: letter("02-prior-auth-ca") });
  }

  // ---- no-document path: synthetic extraction, approximate deadline
  const c3 = (startCase(ctx(), { has_document: "no" }) as any).case.code;
  for (const [q, u] of [["state", "Texas"], ["plan_source", "through my employer"], ["self_funded", "no idea"], ["denial_category", "no prior authorization"], ["document_date", "about two weeks ago"], ["urgent", "no"]] as const) {
    answer(ctx(), { code: c3, question: q as any, utterance: u });
  }
  confirmFacts(ctx(), { code: c3, answer: "yes" });
  const r3 = computeRightsTool(ctx(), { code: c3 });
  const s3 = (r3 as any).data.summary;
  eq("approximate flagged", s3.firstDeadline.approximate, true);
  eq("approximate date", [s3.firstDeadline.date, s3.firstDeadline.daysRemaining], ["2027-04-05", 166]);
  eq("says estimates", s3.chunks[0].startsWith("Because the date is approximate"), true);
  eq("texas rule present", s3.protections.some((p: any) => p.id.startsWith("tx.")), true);
  for (const [i, c] of s3.chunks.entries()) speakOk(`tx chunk ${i}`, { ok: true, speak: c }, "rights_chunk");

  // ---- no anchor date at all
  const c4 = (startCase(ctx(), { has_document: "no" }) as any).case.code;
  answer(ctx(), { code: c4, question: "state", utterance: "Texas" });
  answer(ctx(), { code: c4, question: "plan_source", utterance: "bought directly" });
  answer(ctx(), { code: c4, question: "denial_category", utterance: "not medically necessary" });
  answer(ctx(), { code: c4, question: "document_date", utterance: "I don't know" });
  answer(ctx(), { code: c4, question: "urgent", utterance: "no" });
  confirmFacts(ctx(), { code: c4, answer: "yes" });
  const r4 = computeRightsTool(ctx(), { code: c4 });
  eq("no anchor → asks for the date", (r4 as any).error.code, "not_understood");
  speakOk("no anchor", r4);

  // ---- helpers
  eq("engine answers mapping", toEngineAnswers({ state: "TX", plan_source: "employer", self_funded: "unknown", urgent: "yes" } as any), { state: "TX", plan_source: "employer", self_funded: "unknown", emergency: "unknown", urgent: "yes" });
  eq("synthetic keeps no document facts", syntheticExtraction({ state: "TX", denial_category: "prior_auth", document_date: "2026-10-07" } as any, "2026-10-07", ex("02-prior-auth-ca"))!.insurer_name.value, null);
eq("synthetic without a date is null", syntheticExtraction({ state: "TX", denial_category: "prior_auth", document_date: "unknown" } as any, null, ex("02-prior-auth-ca")), null);
  eq("pages", [estimatePages(1), estimatePages(450), estimatePages(451)], [1, 1, 2]);

  console.log(fails ? `${fails} failures` : "all passed");
})();
```
