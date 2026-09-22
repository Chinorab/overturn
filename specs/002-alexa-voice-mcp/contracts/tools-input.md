# Tool handlers, part 2 — executable contract (T012)

`overturn_attach_document` (the only model call on the input side) and `overturn_answer`
(one spoken answer at a time, plus single-field corrections). Both pure apart from the injected
extractor; every spoken string still comes from a template.

**Run on 2026-09-22** against the real store, machine, parsers and the golden extractions of
samples 01 and 02: 47 assertions pass, every `speak` checked through `turn-check`, and the
T007/T008/T009/T011 suites re-run clean after the parser change below.

## Three bugs the run found

1. **"no, it was scheduled" was read as ambiguous.** `parseYesNo` matched `no` *and* the filler
   `it was` from the YES list, so it returned `null` and the assistant re-asked a question the
   person had already answered. Fix: a **leading** yes/no token decides, because people qualify
   *after* their answer; it is only ambiguous when the opposite word follows within two words
   ("yes no wait"). The loose fillers (`it is`, `it was`, `i do`, `i don't`) are gone from both
   lists.
2. **The answers bag used keys the sequencer never checked** (`denial_category_hint`,
   `letter_date`), so after answering the reason the assistant asked for the reason again. The bag
   is now keyed by **question id** — the same keys `nextQuestion()` looks up — and the mapping to
   the engine's `Answers` happens later, in `compute_rights`.
3. **"I don't know" did not advance.** The unknown branch wrote only a side field; it now records
   `unknown` under the question's own key, so the sequencer moves on.

Each of these would have surfaced as an assistant repeating itself in the middle of the demo.

## Design notes

| Decision | Why |
|---|---|
| The size check runs **before** the extractor | A 10 MB photo must not cost a model call; the test asserts the extractor was not called |
| `extraction_invalid` is reported as `unsupported_document` to the client, with a "try another photo, or answer a few questions" line | The person does not care which layer failed; both routes stay open |
| `unsupported_coverage` closes the case inside the handler | No later tool can produce rights or a letter for a Medicare document |
| Every failure line ends with a question and contains **no day count** | Voice-design: no dead ends, and never a number we cannot source |
| `advance(rec, today)` is the single place that decides the next question | Used by attach, answer and confirm, so the three cannot disagree |
| Corrections change **one field** of the extraction, set confidence to "the person told me", reset `readback.confirmed` to `null`, and re-read only that field | FR-003: the corrected facts must be confirmed again |
| A date correction that disagrees with the letter adds the discrepancy note | "Your letter says August 20th, so I'll use your date and flag the difference in the letter." |
| The correction field can be named by the client or guessed from the words ("the insurer is Empire Health") | The orchestrator does not have to parse for us |
| `not_understood` re-asks with the same ≤ 4 options, spoken as a list | Voice-design §6, progressive re-prompting |

## `mcp/src/tools/input.ts`

```ts
/**
 * T012 handlers: overturn_attach_document (the only model call on the input side) and
 * overturn_answer (one spoken answer at a time → the engine's values).
 * Pure apart from the injected extractor; every spoken string comes from a template.
 */
import { z } from "zod";
import type { Extraction } from "@/lib/schemas/extraction";
import { DENIAL_CATEGORY_LABEL, type USStateCode } from "@/lib/schemas/core";
import { gate, next, nextQuestion, type QuestionId } from "./machine";
import { documentReadback, answersReadback, fieldReadback, type ReadbackField } from "./readback";
import { parseAnswer, parseYesNo, OPTIONS, type QuestionId as ParseQuestionId } from "./answers";
import { spokenDate, spokenMoney } from "./spoken";
import { ok, fail, fromGate, type Envelope } from "./envelope";
import { QUESTION_SPEAK, type Ctx, type Facts } from "./tools-basic";
import type { CaseRecord } from "./store";

// ---------------------------------------------------------------- shared
function open(ctx: Ctx, code: string): { rec: CaseRecord<Facts> } | { env: Envelope<never> } {
  const r = ctx.store.get(code, ctx.sessionId);
  if (r.ok) return { rec: r.record };
  const speak = r.error === "wrong_session" ? "That code belongs to a different conversation. Would you like to say the code again?"
    : r.error === "case_closed" ? "That case is finished and I kept nothing. Shall I start a new one?"
      : "I don't have that case any more — it may have been more than thirty minutes. Shall we start again?";
  return { env: fail(r.error, `case ${code}`, speak) };
}

/** After facts exist, ask the next question or move on. Shared by attach, answer and confirm. */
export function advance(rec: CaseRecord<Facts>, today: string): { next: QuestionId | "confirm_facts" | "compute_rights"; speak: string } {
  const path = rec.path === "no_document" ? "no_document" : "document";
  const q = nextQuestion(path, rec.facts.answers, {
    planSource: rec.facts.answers.plan_source ?? null,
    denialCategory: rec.facts.extraction?.denial_category.value ?? rec.facts.answers.denial_category ?? null,
  });
  if (q === "compute_rights") return { next: q, speak: "Thanks. Shall I tell you your deadlines?" };
  if (q === "confirm_facts") return { next: q, speak: answersReadbackFor(rec, today).spoken };
  if (q === "state") {
    const hint = rec.facts.extraction?.state_hint.value;
    return { next: q, speak: hint ? `The letter looks like it's from ${hint} — is that where you live?` : QUESTION_SPEAK.state };
  }
  return { next: q, speak: QUESTION_SPEAK[q] };
}

function answersReadbackFor(rec: CaseRecord<Facts>, today: string) {
  return answersReadback({
    state: (rec.facts.answers.state as string) ?? "",
    plan_source: (rec.facts.answers.plan_source as string) ?? "other",
    denial_category: (rec.facts.answers.denial_category ?? "other") as never,
    approxDate: rec.facts.approxDocumentDate,
  }, today);
}

// ---------------------------------------------------------------- overturn_attach_document
export const AttachInput = z.object({
  code: z.string(),
  document: z.object({
    kind: z.enum(["pdf", "image"]),
    media_type: z.enum(["application/pdf", "image/jpeg", "image/png"]).optional(),
    base64: z.string().min(1),
  }),
});

export const MAX_BYTES = 10 * 1024 * 1024;

export type Extractor = (doc: { kind: "pdf" | "image"; media_type?: string; base64: string }) => Promise<
  | { ok: true; extraction: Extraction }
  | { ok: false; reason: "unsupported_document" | "unsupported_coverage" | "model_unavailable" | "unsupported_on_provider" | "extraction_invalid"; detail?: string }
>;

const ATTACH_ERROR_SPEAK: Record<string, string> = {
  unsupported_coverage: "This looks like a Medicare or Medicaid notice. Those appeals work differently, with their own deadlines, and I'd rather not guess. Would you like me to email you the official appeal steps?",
  unsupported_document: "I couldn't tell that this is a denial letter or an explanation of benefits. Would you like to try another photo, or answer a few questions instead?",
  extraction_invalid: "I couldn't read that one clearly. Would you like to try another photo, or answer a few questions instead?",
  model_unavailable: "I can't read documents right now. I can still tell you your deadlines from a few questions — shall we do that?",
  unsupported_on_provider: "I can't read photos with the model I'm using right now. A PDF works, or we can do it with a few questions — which would you like?",
  too_large: "That file is over ten megabytes. Would you like to try a smaller photo?",
};

export async function attachDocument(ctx: Ctx & { extract: Extractor }, input: z.infer<typeof AttachInput>): Promise<Envelope<unknown>> {
  const found = open(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_attach_document", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  const bytes = Math.floor((input.document.base64.length * 3) / 4);
  if (bytes > MAX_BYTES) return fail("too_large", `${bytes} bytes`, ATTACH_ERROR_SPEAK.too_large, { code: rec.code, status: rec.status });

  const result = await ctx.extract(input.document);
  if (!result.ok) {
    if (result.reason === "unsupported_coverage") ctx.store.close(rec.code, "discarded");
    const code = result.reason === "extraction_invalid" ? "unsupported_document" : result.reason;
    return fail(code as never, result.detail ?? result.reason, ATTACH_ERROR_SPEAK[result.reason], { code: rec.code, status: result.reason === "unsupported_coverage" ? "discarded" : rec.status });
  }

  rec.facts.extraction = result.extraction;
  rec.path = rec.path === "no_document" ? "document" : (rec.path ?? "document");
  rec.facts.readback = documentReadback(result.extraction, ctx.today);
  rec.status = next("overturn_attach_document", rec.status);
  return ok(rec.code, rec.status, { readback: rec.facts.readback, next: "confirm_facts" }, rec.facts.readback.spoken);
}

// ---------------------------------------------------------------- overturn_answer
export const AnswerInput = z.object({
  code: z.string(),
  question: z.enum(["state", "plan_source", "self_funded", "emergency", "urgent", "denial_category", "document_date", "correction"]),
  utterance: z.string().min(1),
  field: z.enum(["insurer", "service", "date", "amount", "reason"]).optional(),
});

const NOT_UNDERSTOOD_SPEAK = (q: ParseQuestionId): string => {
  const opts = (OPTIONS as Record<string, string[]>)[q];
  if (q === "state") return "Sorry — which state do you live in?";
  if (q === "document_date") return "Sorry — roughly when did the letter arrive? A month and a day, or something like two weeks ago.";
  return opts ? `Sorry — ${listSpoken(opts)}?` : "Sorry, I didn't catch that. Could you say it again?";
};
const listSpoken = (opts: string[]) => opts.length <= 1 ? opts[0] : `${opts.slice(0, -1).join(", ")}, or ${opts.at(-1)}`;

export function answer(ctx: Ctx, input: z.infer<typeof AnswerInput>): Envelope<unknown> {
  const found = open(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_answer", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  if (input.question === "correction") return correction(ctx, rec, input);

  const parsed = parseAnswer(input.question, input.utterance, {
    today: ctx.today,
    stateHint: rec.facts.extraction?.state_hint.value ?? null,
  });

  if (parsed === null) {
    return fail("not_understood", `could not map "${input.utterance}" for ${input.question}`, NOT_UNDERSTOOD_SPEAK(input.question), { code: rec.code, status: rec.status });
  }
  if (parsed === "unknown") {
    // "I don't know" is still an answer: record it under the question's own key so the
    // sequencer moves on instead of asking again.
    (rec.facts.answers as Record<string, unknown>)[input.question] = "unknown";
    if (input.question === "denial_category") rec.facts.answers.denial_category = "other";
    if (input.question === "document_date") rec.facts.approxDocumentDate = null;
    const a = advance(rec, ctx.today);
    return ok(rec.code, rec.status, { understood: { field: input.question, value: "unknown", spoken: "That's fine." }, next: a.next, options: optionsFor(a.next) }, `That's fine. ${a.speak}`);
  }

  // store
  switch (parsed.field) {
    case "state": rec.facts.answers.state = parsed.value as USStateCode; break;
    case "plan_source": rec.facts.answers.plan_source = parsed.value; break;
    case "self_funded": case "emergency": rec.facts.answers[parsed.field] = parsed.value; break;
    case "urgent": rec.facts.answers.urgent = parsed.value; break;
    case "denial_category": rec.facts.answers.denial_category = parsed.value; break;
    case "document_date":
      rec.facts.approxDocumentDate = parsed.approximate ? parsed.value : null;
      rec.facts.answers.document_date = parsed.value;
      break;
  }

  const a = advance(rec, ctx.today);
  rec.status = next("overturn_answer", rec.status, { answersComplete: a.next === "confirm_facts" || a.next === "compute_rights" });
  const echo = spokenEcho(parsed, ctx.today);
  return ok(rec.code, rec.status, {
    understood: { field: parsed.field, value: (parsed as { value: unknown }).value, spoken: echo, approximate: "approximate" in parsed ? parsed.approximate : undefined },
    next: a.next, options: optionsFor(a.next),
  }, `${echo} ${a.speak}`.trim());
}

function optionsFor(q: string): string[] | undefined {
  return (OPTIONS as Record<string, string[]>)[q];
}

function spokenEcho(parsed: Exclude<ReturnType<typeof parseAnswer>, null | "unknown">, today: string): string {
  switch (parsed.field) {
    case "state": return `${parsed.value}.`;
    case "plan_source": return { employer: "Through your employer.", marketplace: "Through the Marketplace.", direct: "Bought directly.", other: "Other coverage." }[parsed.value];
    case "denial_category": return `${DENIAL_CATEGORY_LABEL[parsed.value]}.`;
    case "document_date": return parsed.approximate ? `Around ${spokenDate(parsed.value, today)}, then.` : `${spokenDate(parsed.value, today)}.`;
    case "self_funded": case "emergency": case "urgent": return "";     // folded into the next question
  }
}

// ---------------------------------------------------------------- corrections
function correction(ctx: Ctx, rec: CaseRecord<Facts>, input: z.infer<typeof AnswerInput>): Envelope<unknown> {
  const ex = rec.facts.extraction;
  if (!ex || !rec.facts.readback) return fail("wrong_state", "nothing to correct", "There's nothing to correct yet. Shall we start with the document?", { code: rec.code, status: rec.status });
  const field = input.field ?? guessField(input.utterance);
  if (!field) return fail("not_understood", `no field in "${input.utterance}"`, "Which part is off — the insurer, the service, the date, or the amount?", { code: rec.code, status: rec.status });

  const applied = applyCorrection(ex, field, input.utterance, ctx.today);
  if (!applied) return fail("not_understood", `could not read a ${field}`, RE_ASK[field], { code: rec.code, status: rec.status });

  rec.facts.readback = documentReadback(ex, ctx.today);
  rec.facts.readback.confirmed = null;
  const note = applied.note;
  return ok(rec.code, rec.status, { corrected: { field, value: applied.spoken }, next: "confirm_facts" }, fieldReadback(field, applied.spoken, note));
}

const RE_ASK: Record<ReadbackField, string> = {
  insurer: "What's the insurer's name?",
  service: "What was the service?",
  date: "What date was it?",
  amount: "What was the amount?",
  reason: "What reason did they give — not medically necessary, no prior authorization, out of network, or something else?",
};

function guessField(utterance: string): ReadbackField | null {
  const s = utterance.toLowerCase();
  if (/insurer|insurance|plan|company/.test(s)) return "insurer";
  if (/service|procedure|surgery|scan|visit|treatment/.test(s)) return "service";
  if (/date|day|when/.test(s)) return "date";
  if (/amount|cost|price|dollars|money|bill/.test(s)) return "amount";
  if (/reason|why|because/.test(s)) return "reason";
  return null;
}

/** Corrections change the extraction in place, and only the field named. Confidence drops to "the person told me". */
function applyCorrection(ex: Extraction, field: ReadbackField, utterance: string, today: string): { spoken: string; note?: string } | null {
  const said = (v: unknown) => ({ value: v, confidence: 1, quote: null, page: null }) as never;
  switch (field) {
    case "insurer": {
      const name = utterance.replace(/^(it'?s|the insurer is|insurer|it is)\s+/i, "").trim();
      if (name.length < 2) return null;
      ex.insurer_name = said(name); return { spoken: name };
    }
    case "service": {
      const s = utterance.replace(/^(it'?s|it was|the service is|service)\s+/i, "").trim();
      if (s.length < 2) return null;
      ex.service_description = said(s); return { spoken: s };
    }
    case "date": {
      const d = parseAnswer("document_date", utterance, { today });
      if (!d || d === "unknown" || d.field !== "document_date") return null;
      const was = ex.service_dates.value?.[0];
      ex.service_dates = said([d.value]);
      return { spoken: spokenDate(d.value, today), note: was && was !== d.value ? `Your letter says ${spokenDate(was, today)}, so I'll use your date and flag the difference in the letter.` : undefined };
    }
    case "amount": {
      const m = utterance.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
      if (!m) return null;
      const n = Number(m[1]);
      ex.amounts = { ...ex.amounts, billed: said(n) };
      return { spoken: spokenMoney(n) };
    }
    case "reason": {
      const c = parseAnswer("denial_category", utterance, { today });
      if (!c || c === "unknown" || c.field !== "denial_category") return null;
      ex.denial_category = said(c.value);
      return { spoken: DENIAL_CATEGORY_LABEL[c.value].toLowerCase() };
    }
  }
}

/** Yes/no arriving through `answer` (the orchestrator may route "yes" here). */
export const parseSpokenYesNo = parseYesNo;
```

## Tests (`tests/mcp/tools-input.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { CaseStore } from "./store";
import { startCase, confirmFacts, type Ctx, type Facts } from "./tools-basic";
import { attachDocument, answer, MAX_BYTES, type Extractor } from "./tools-input";
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
let now = Date.parse("2026-10-21T10:00:00Z");
const store = new CaseStore<Facts>({ clock: () => now });

let extractor: Extractor = async () => ({ ok: true, extraction: ex("02-prior-auth-ca") });
const ctx = (sessionId = "s1") => ({
  store, sessionId, today: TODAY,
  account: { email: "walter.demo@gmail.com", emailMasked: "w•••@gmail.com", emailMaskedSpoken: "w-dot-gmail-dot-com" },
  loadSample: async () => null, samples: [],
  extract: (d: any) => extractor(d),
}) as Ctx & { extract: Extractor };

const b64 = (n: number) => "A".repeat(n);

(async () => {
  // ---- attach: happy path
  let code = (startCase(ctx(), { has_document: "yes" }) as any).case.code;
  const att = await attachDocument(ctx(), { code, document: { kind: "pdf", media_type: "application/pdf", base64: b64(1000) } });
  eq("attach → facts_pending", (att as any).case.status, "facts_pending");
  eq("readback spoken", (att as any).speak.startsWith("Here's what I read: Pacific Crest Health Plan"), true);
  speakOk("attach readback", att, "readback_only");

  // ---- attach: too large, never calls the model
  let called = 0; extractor = async () => { called++; return { ok: true, extraction: ex("02-prior-auth-ca") }; };
  const big = await attachDocument(ctx(), { code: (startCase(ctx(), { has_document: "yes" }) as any).case.code, document: { kind: "image", media_type: "image/jpeg", base64: b64(Math.ceil((MAX_BYTES + 1) * 4 / 3)) } });
  eq("too large", (big as any).error.code, "too_large");
  eq("model not called", called, 0);
  speakOk("too large", big);

  // ---- attach: each failure reason
  for (const [reason, expectCode, expectStatus] of [
    ["unsupported_coverage", "unsupported_coverage", "discarded"],
    ["unsupported_document", "unsupported_document", "awaiting_document"],
    ["extraction_invalid", "unsupported_document", "awaiting_document"],
    ["model_unavailable", "model_unavailable", "awaiting_document"],
    ["unsupported_on_provider", "unsupported_on_provider", "awaiting_document"],
  ] as const) {
    extractor = async () => ({ ok: false, reason: reason as never });
    const c = (startCase(ctx(), { has_document: "yes" }) as any).case.code;
    const r = await attachDocument(ctx(), { code: c, document: { kind: "pdf", base64: b64(100) } });
    eq(`attach ${reason} code`, (r as any).error.code, expectCode);
    eq(`attach ${reason} status`, (r as any).case.status, expectStatus);
    eq(`attach ${reason} no day count`, /\d+ days/.test((r as any).error.speak), false);
    speakOk(`attach ${reason}`, r);
  }
  extractor = async () => ({ ok: true, extraction: ex("02-prior-auth-ca") });

  // ---- answer: the sample-02 sequence, marketplace skips self_funded
  confirmFacts(ctx(), { code, answer: "yes" });
  const st = answer(ctx(), { code, question: "state", utterance: "yes, California" });
  eq("state understood", (st as any).data.understood.value, "CA");
  eq("next plan_source", (st as any).data.next, "plan_source");
  eq("options ≤ 4", ((st as any).data.options ?? []).length <= 4, true);
  speakOk("state answer", st);
  const ps = answer(ctx(), { code, question: "plan_source", utterance: "through Covered California" });
  eq("marketplace", (ps as any).data.understood.value, "marketplace");
  eq("skips self_funded", (ps as any).data.next, "emergency");
  speakOk("plan source answer", ps);
  const em = answer(ctx(), { code, question: "emergency", utterance: "no, it was scheduled" });
  eq("emergency no", (em as any).data.understood.value, "no");
  eq("next urgent", (em as any).data.next, "urgent");
  const ur = answer(ctx(), { code, question: "urgent", utterance: "no, it's done" });
  eq("ready for rights", (ur as any).data.next, "compute_rights");
  speakOk("urgent answer", ur);

  // ---- answer: not understood re-asks with ≤ 4 options
  const bad = answer(ctx(), { code, question: "plan_source", utterance: "the blue one" });
  eq("not understood", (bad as any).error.code, "not_understood");
  eq("re-ask lists options", (bad as any).error.speak, "Sorry — through an employer, the Marketplace, or bought directly?");
  speakOk("re-ask", bad);
  const badState = answer(ctx(), { code, question: "state", utterance: "I don't know" });
  eq("state has no unknown", (badState as any).error.code, "not_understood");
  speakOk("state re-ask", badState);

  // ---- answer: "I don't know" accepted elsewhere
  const c2 = (startCase(ctx(), { has_document: "no" }) as any).case.code;
  answer(ctx(), { code: c2, question: "state", utterance: "Texas" });
  answer(ctx(), { code: c2, question: "plan_source", utterance: "through my employer" });
  const sf = answer(ctx(), { code: c2, question: "self_funded", utterance: "no idea" });
  eq("unknown accepted", (sf as any).data.understood.value, "unknown");
  eq("next denial_category", (sf as any).data.next, "denial_category");
  speakOk("unknown answer", sf);
  const dc = answer(ctx(), { code: c2, question: "denial_category", utterance: "they said there was no prior authorization" });
  eq("category", (dc as any).data.understood.value, "prior_auth");
  eq("next document_date", (dc as any).data.next, "document_date");
  const dd = answer(ctx(), { code: c2, question: "document_date", utterance: "about two weeks ago" });
  eq("approx date", [(dd as any).data.understood.value, (dd as any).data.understood.approximate], ["2026-10-07", true]);
  eq("echo says around", (dd as any).speak.startsWith("Around October 7th, then."), true);
  speakOk("date answer", dd);
  const u2 = answer(ctx(), { code: c2, question: "urgent", utterance: "no" });
  eq("no-doc ends on confirm", (u2 as any).data.next, "confirm_facts");
  eq("answers read back", (u2 as any).speak.includes("So far: TX"), true);
  speakOk("answers readback", u2, "readback_only");

  // ---- corrections: one field only, with the discrepancy note
  const c3 = (startCase(ctx(), { has_document: "yes" }) as any).case.code;
  extractor = async () => ({ ok: true, extraction: ex("01-medical-necessity-ny") });
  await attachDocument(ctx(), { code: c3, document: { kind: "pdf", base64: b64(100) } });
  confirmFacts(ctx(), { code: c3, answer: "no" });
  const corr = answer(ctx(), { code: c3, question: "correction", field: "date", utterance: "September 2nd" });
  eq("corrected date", (corr as any).data.corrected.value, "September 2nd");
  eq("mentions the letter's date", (corr as any).speak.includes("Your letter says August 20th"), true);
  eq("ends with Better?", (corr as any).speak.endsWith("Better?"), true);
  speakOk("correction", corr);
  const corr2 = answer(ctx(), { code: c3, question: "correction", field: "amount", utterance: "it was $2,650" });
  eq("corrected amount", (corr2 as any).data.corrected.value, "two thousand six hundred fifty dollars");
  const corr3 = answer(ctx(), { code: c3, question: "correction", utterance: "the insurer is Empire Health" });
  eq("field guessed from words", (corr3 as any).data.corrected.field, "insurer");
  const corrBad = answer(ctx(), { code: c3, question: "correction", field: "amount", utterance: "no clue" });
  eq("unreadable correction", (corrBad as any).error.code, "not_understood");
  speakOk("correction re-ask", corrBad);
  // the re-read carries the corrections and nothing else changed
  const back = answer(ctx(), { code: c3, question: "correction", field: "service", utterance: "an MRI of the right knee" });
  eq("service corrected", (back as any).data.corrected.value, "an MRI of the right knee");
  eq("confirmation reset", (store as any).cases.get(c3).facts.readback.confirmed, null);

  console.log(fails ? `${fails} failures` : "all passed");
})();
```
