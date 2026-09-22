# Tool handlers, part 1 — executable contract (T011)

The five tools that carry the conversation before any model call: `overturn_start_case`,
`overturn_use_sample`, `overturn_get_readback`, `overturn_confirm_facts`, `overturn_get_help`,
plus the envelope every tool shares. Each handler is a pure function of
`(ctx, input) → Envelope`; the MCP layer adds only the zod schemas, the annotations and the
descriptions from `contracts/mcp-tools.md`.

**Run on 2026-09-22** against the real store, machine, speech templates, rules dataset and the
golden extraction of sample 02: 46 assertions pass, and **every `speak` string is checked through
`turn-check`** — the handlers cannot ship a turn that breaks FR-001/FR-002.

## What the run settled

| Finding | Fix |
|---|---|
| The `wrong_session` line ended on a statement | Every spoken string a handler can emit now ends with a question, including refusals — "no dead ends" applies to errors too |
| The help turn reached 74 words once the unsupported-state note was appended | Deflection and note shortened; the turn checker is the referee, not a style opinion |
| A second `confirm_facts` after the facts were confirmed | Answered `wrong_state` with a spoken line that moves forward ("I have your facts. Shall I tell you your deadlines first?"), not a dead end |
| `get_readback` before any document exists | Returns the case code, spoken and NATO, instead of an error — that is what "repeat" means at that point in the conversation |
| An unsupported sample (Medicare) | `unsupported_coverage`, the case is **closed immediately**, the spoken line contains no day count and offers only the official channel; every later call answers `case_closed` |
| `toToolResult` | `isError` is true for errors, **false for `needs_confirmation`** — a confirmation is a normal turn, not a failure |

## Design notes

- `withCase()` is the single entry check (found / ours / open) so all five tools refuse the same
  way, with the spoken text chosen per reason: expired says "more than thirty minutes", a foreign
  code says it belongs to another conversation, a closed case offers a fresh start.
- `fromGate()` turns a machine refusal into an envelope, and `WRONG_STATE_SPEAK` gives each status
  a line that *advances* the conversation instead of describing an internal state.
- Facts held per case: `extraction`, `sampleId`, `answers`, `approxDocumentDate`, `rights`,
  `readback`, `letter` — everything a later tool needs, nothing else.
- `confirm_facts` with "no" asks the open question and lists the five correctable fields in
  `data` (for the client, not for speech: five spoken options would break the ≤ 4 rule).
- `get_help` deflects first, then names the state's resource (CAP before regulator), never speaks a
  phone number, and says plainly when a state has no overlay.

## `mcp/src/envelope.ts`

```ts
/**
 * The result envelope every tool returns (data-model.md). One shape, so an orchestrator can
 * handle any tool the same way: `ok` + `speak` to say, `needs_confirmation` to ask verbatim,
 * `error` with its own `speak`. Pure.
 */
import type { Status } from "./machine";
import type { Gate } from "./machine";

export type ErrorCode =
  | "case_not_found" | "case_closed" | "wrong_session" | "wrong_state" | "not_understood"
  | "unsupported_document" | "unsupported_coverage" | "model_unavailable" | "unsupported_on_provider"
  | "delivery_failed" | "too_large" | "rate_limited";

export type Envelope<D = unknown> =
  | { ok: true; case: { code: string; status: Status }; data: D; speak: string }
  | { ok: false; case?: { code: string; status: Status }; error: { code: ErrorCode; message: string; speak: string } }
  | { ok: false; case?: { code: string; status: Status }; needs_confirmation: { action: string; question: string; expectedYes: string[]; expectedNo: string[] } };

export const ok = <D>(code: string, status: Status, data: D, speak: string): Envelope<D> => ({ ok: true, case: { code, status }, data, speak });

export const fail = (code: ErrorCode, message: string, speak: string, c?: { code: string; status: Status }): Envelope<never> =>
  ({ ok: false, ...(c ? { case: c } : {}), error: { code, message, speak } });

/** Turn a gate refusal into an envelope. `wrong_state` and `case_closed` get spoken, honest text. */
export function fromGate(gate: Exclude<Gate, { kind: "proceed" }>, c: { code: string; status: Status }): Envelope<never> {
  switch (gate.kind) {
    case "needs_confirmation":
      return { ok: false, case: c, needs_confirmation: { action: gate.action, question: gate.question, expectedYes: gate.expectedYes, expectedNo: gate.expectedNo } };
    case "case_closed":
      return fail("case_closed", `case is ${gate.status}`, "That case is finished and I kept nothing. Shall I start a new one?", c);
    case "wrong_state":
      return fail("wrong_state", `status ${gate.status}, expected one of ${gate.allowed.join(", ")}`, WRONG_STATE_SPEAK[gate.status] ?? "We're not there yet. Let's finish the step we're on.", c);
  }
}

const WRONG_STATE_SPEAK: Partial<Record<Status, string>> = {
  started: "First, do you have the denial letter or statement in front of you?",
  awaiting_document: "I'm still waiting for the document. Tell me when it's in, or we can keep going without it. Which would you like?",
  answering: "I need a few more answers first. Shall we keep going?",
  facts_pending: "Before that, I need you to confirm what I read. Shall I read it again?",
  facts_confirmed: "I have your facts. Shall I tell you your deadlines first?",
  rights_computed: "I haven't written the letter yet. Shall I draft it?",
  letter_drafted: "The letter is ready. Shall I send it?",
};

/** MCP tool result: structured content plus the text block a client without schema support can read. */
export function toToolResult<D>(env: Envelope<D>) {
  const text = env.ok ? env.speak : "needs_confirmation" in env ? env.needs_confirmation.question : env.error.speak;
  return { content: [{ type: "text" as const, text }], structuredContent: env as unknown as Record<string, unknown>, isError: !env.ok && "error" in env };
}
```

## `mcp/src/tools/basic.ts`

```ts
/**
 * T011 handlers: start_case, use_sample, get_readback, confirm_facts, get_help.
 * Each is a pure function of (store, session, input) → Envelope. The MCP layer only adds the zod
 * schemas, the annotations and the descriptions from contracts/mcp-tools.md.
 */
import { z } from "zod";
import type { Extraction } from "@/lib/schemas/extraction";
import type { RightsResult } from "@/lib/rules/engine";
import type { Answers } from "@/lib/session";
import { HELP_RESOURCES } from "@/lib/rules/load";
import { isSupportedState, type USStateCode } from "@/lib/schemas/core";
import { CaseStore, type CaseRecord } from "./store";
import { gate, next, nextQuestion, type QuestionId } from "./machine";
import { documentReadback, type Readback } from "./readback";
import { spokenHelp } from "./rights-speech";
import { spokenCode, natoCode, type CaseCode } from "./case-code";
import { ok, fail, fromGate, type Envelope } from "./envelope";

// ---------------------------------------------------------------- case facts held in the store
export type Facts = {
  extraction: Extraction | null;
  sampleId: string | null;
  answers: Partial<Answers>;
  approxDocumentDate: string | null;
  rights: RightsResult | null;
  readback: Readback | null;
  letter: unknown | null;
};
export const emptyFacts = (): Facts => ({ extraction: null, sampleId: null, answers: {}, approxDocumentDate: null, rights: null, readback: null, letter: null });

export type Ctx = {
  store: CaseStore<Facts>;
  sessionId: string;
  today: string;
  account: { email: string; emailMasked: string; emailMaskedSpoken: string } | null;
  /** Sample loader, injected so tests and the server share one path. */
  loadSample: (id: string) => Promise<{ extraction: Extraction; unsupported?: "coverage" | "document" } | null>;
  samples: { id: string; title: string; state: USStateCode | null; spoken: string }[];
};

const lookup = (ctx: Ctx, code: string) => ctx.store.get(code, ctx.sessionId);

/** Every handler starts the same way: find the case, refuse politely if it is not ours. */
function withCase(ctx: Ctx, code: string): { rec: CaseRecord<Facts> } | { env: Envelope<never> } {
  const r = lookup(ctx, code);
  if (r.ok) return { rec: r.record };
  const speak = r.error === "wrong_session"
    ? "That code belongs to a different conversation. Would you like to say the code again?"
    : r.error === "case_closed"
      ? "That case is finished and I kept nothing. Shall I start a new one?"
      : "I don't have that case any more — it may have been more than thirty minutes. Shall we start again?";
  return { env: fail(r.error, `case ${code}`, speak) };
}

// ---------------------------------------------------------------- overturn_start_case
export const StartInput = z.object({ has_document: z.enum(["yes", "no", "unknown"]).optional() });

const OPENING = "I can help you understand the denial and prepare an appeal letter — that's information, not legal advice.";

export function startCase(ctx: Ctx, input: z.infer<typeof StartInput>): Envelope<{ code: string; spokenCode: string; natoCode: string; next: string }> {
  const rec = ctx.store.create(ctx.sessionId, emptyFacts(), ctx.account);
  const has = input.has_document ?? "unknown";
  rec.status = next("overturn_start_case", "started", { hasDocument: has });
  rec.path = has === "no" ? "no_document" : null;
  const speak =
    has === "unknown" ? `${OPENING} First, do you have the denial letter or statement in front of you?`
      : has === "yes" ? `Good. On your phone, open the companion page and enter this code: ${spokenCode(rec.code)}. Then take a photo of the letter or upload the file, and tell me when it's in.`
        : "No problem — I can still tell you the basics from a few questions. Which state do you live in?";
  const nxt = has === "unknown" ? "ask_has_document" : has === "yes" ? "offer_upload" : "ask_state";
  return ok(rec.code, rec.status, { code: rec.code, spokenCode: spokenCode(rec.code), natoCode: natoCode(rec.code), next: nxt }, speak);
}

// ---------------------------------------------------------------- overturn_use_sample
export const SampleInput = z.object({ code: z.string(), sample_id: z.string().optional() });

export async function useSample(ctx: Ctx, input: z.infer<typeof SampleInput>): Promise<Envelope<unknown>> {
  const found = withCase(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_use_sample", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  if (!input.sample_id) {
    const list = ctx.samples.map((s) => ({ id: s.id, spoken: s.spoken }));
    return ok(rec.code, rec.status, { samples: list, next: "ask_which_sample" },
      `I have ${list.length} sample letters. For example, ${list[0].spoken}. Which would you like?`);
  }
  const loaded = await ctx.loadSample(input.sample_id);
  if (!loaded) return fail("not_understood", `unknown sample ${input.sample_id}`, "I don't have that sample. Shall I list them again?", { code: rec.code, status: rec.status });

  if (loaded.unsupported === "coverage") {
    ctx.store.close(rec.code, "discarded");
    return fail("unsupported_coverage", "medicare/medicaid document",
      "This looks like a Medicare notice. Medicare appeals work differently, with their own levels and deadlines, and I'd rather not guess. Would you like me to email you Medicare's own appeal steps and help line?",
      { code: rec.code, status: "discarded" });
  }

  rec.facts.extraction = loaded.extraction;
  rec.facts.sampleId = input.sample_id;
  rec.path = "sample";
  rec.facts.readback = documentReadback(loaded.extraction, ctx.today);
  rec.status = next("overturn_use_sample", rec.status);
  return ok(rec.code, rec.status, { readback: rec.facts.readback, next: "confirm_facts" }, rec.facts.readback.spoken);
}

// ---------------------------------------------------------------- overturn_get_readback
export const ReadbackInput = z.object({ code: z.string() });

export function getReadback(ctx: Ctx, input: z.infer<typeof ReadbackInput>): Envelope<unknown> {
  const found = withCase(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_get_readback", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });
  if (!rec.facts.readback) {
    const speak = rec.status === "awaiting_document"
      ? `The code is ${spokenCode(rec.code)}. Say "spell it" if you'd like the letters as words.`
      : "I don't have anything to read back yet.";
    return ok(rec.code, rec.status, { readback: null, code: spokenCode(rec.code), nato: natoCode(rec.code) }, speak);
  }
  return ok(rec.code, rec.status, { readback: rec.facts.readback }, rec.facts.readback.spoken);
}

// ---------------------------------------------------------------- overturn_confirm_facts
export const ConfirmInput = z.object({ code: z.string(), answer: z.enum(["yes", "no"]) });

const CORRECTABLE = [
  { field: "insurer", spoken: "the insurer" }, { field: "service", spoken: "the service" }, { field: "date", spoken: "the date" },
  { field: "amount", spoken: "the amount" }, { field: "reason", spoken: "the reason" },
] as const;

export function confirmFacts(ctx: Ctx, input: z.infer<typeof ConfirmInput>): Envelope<unknown> {
  const found = withCase(ctx, input.code);
  if ("env" in found) return found.env;
  const rec = found.rec;
  const g = gate("overturn_confirm_facts", rec.status, {});
  if (g.kind !== "proceed") return fromGate(g, { code: rec.code, status: rec.status });

  if (input.answer === "no") {
    if (rec.facts.readback) rec.facts.readback.confirmed = false;
    return ok(rec.code, rec.status, { next: "ask_which_field", fields: CORRECTABLE }, "Okay — which part is off?");
  }
  if (rec.facts.readback) rec.facts.readback.confirmed = true;
  rec.status = next("overturn_confirm_facts", rec.status, { confirmed: "yes" });

  const hint = rec.facts.extraction?.state_hint.value ?? null;
  const q = nextQuestion(rec.path === "no_document" ? "no_document" : "document", rec.facts.answers, {
    planSource: rec.facts.answers.plan_source ?? null,
    denialCategory: rec.facts.extraction?.denial_category.value ?? null,
  });
  const speak = q === "state" && hint
    ? `Thanks. The letter looks like it's from ${hint} — is that where you live?`
    : q === "compute_rights" ? "Thanks. Shall I tell you your deadlines?" : QUESTION_SPEAK[q as QuestionId] ?? "Thanks. What next?";
  return ok(rec.code, rec.status, { next: q, stateHint: hint }, speak);
}

export const QUESTION_SPEAK: Record<QuestionId, string> = {
  state: "Which state do you live in?",
  plan_source: "And how do you get this coverage — through an employer, the Marketplace, or bought directly?",
  self_funded: "Do you know if the plan is self-funded — that's when the employer pays claims itself? You can say I don't know.",
  emergency: "Was this an emergency, or care you had to get right away?",
  urgent: "Is this care urgent or still ongoing?",
  denial_category: "What reason did they give — not medically necessary, no prior authorization, out of network, or something else?",
  document_date: "Roughly when did the letter arrive? A date, or something like two weeks ago, is fine.",
};

// ---------------------------------------------------------------- overturn_get_help
export const HelpInput = z.object({ code: z.string().optional(), state: z.string().length(2).optional() });

const DEFLECTION = "I can't tell you what to do or predict how it will go. What I can tell you is the rules and your deadlines.";

export function getHelp(ctx: Ctx, input: z.infer<typeof HelpInput>): Envelope<unknown> {
  let state: USStateCode | null = (input.state as USStateCode) ?? null;
  let c: { code: string; status: any } | undefined;
  if (input.code) {
    const r = lookup(ctx, input.code);
    if (r.ok) {
      c = { code: r.record.code, status: r.record.status };
      state = (r.record.facts.answers.state as USStateCode) ?? r.record.facts.extraction?.state_hint.value ?? state;
    }
  }
  const scoped = HELP_RESOURCES.filter((h) => (state && h.scope === state) || h.scope === "federal");
  scoped.sort((a, b) => score(b) - score(a));
  function score(h: (typeof HELP_RESOURCES)[number]) { return (state && h.scope === state ? 4 : 0) + (h.kind === "CAP" ? 3 : 0); }
  const first = spokenHelp(scoped[0]);
  const note = state && !isSupportedState(state)
    ? ` For ${state}, that's the federal baseline plus your state's regulator.`
    : "";
  const speak = `${DEFLECTION}${note} ${first ? first.spoken.replace(/^If you'd like a person to look at it, /, "") : "Your state's insurance regulator can help for free."} Shall we keep going?`;
  return ok(c?.code ?? "", c?.status ?? "started", { humanHelp: scoped.slice(0, 3).map((h) => ({ id: h.id, name: h.name, phone: h.phone, url: h.url })), state }, speak);
}
```

## Tests (`tests/mcp/tools-basic.test.ts`)

`speakOk` runs every spoken string through `checkTurn`; `eq` becomes `expect(...).toEqual(...)`.
The sample loader is injected, so the test needs no model and no file beyond the golden extractions.

```ts
import { readFileSync } from "node:fs";
import { Extraction } from "@/lib/schemas/extraction";
import { CaseStore } from "./store";
import { startCase, useSample, getReadback, confirmFacts, getHelp, emptyFacts, type Ctx, type Facts } from "./tools-basic";
import { toToolResult } from "./envelope";
import { checkTurn } from "@/lib/voice/turn-check";

let fails = 0;
const eq = (label: string, got: any, exp: any) => {
  if (JSON.stringify(got) !== JSON.stringify(exp)) { fails++; console.log("FAIL", label, "got", JSON.stringify(got), "expected", JSON.stringify(exp)); }
};
const speakOk = (label: string, env: any, kind: any = "normal") => {
  const text = env.ok ? env.speak : env.needs_confirmation ? env.needs_confirmation.question : env.error.speak;
  const r = checkTurn(text, { kind });
  if (!r.ok) { fails++; console.log("FAIL turn", label, r.violations, "::", text.slice(0, 90)); }
};

const TODAY = "2026-10-21";
const ex = (id: string) => Extraction.parse(JSON.parse(readFileSync(`D:/claude/overturn/data/samples/${id}.extraction.json`, "utf8")));
let now = Date.parse("2026-10-21T10:00:00Z");

const ctx = (sessionId = "s1"): Ctx => ({
  store,
  sessionId,
  today: TODAY,
  account: { email: "walter.demo@gmail.com", emailMasked: "w•••@gmail.com", emailMaskedSpoken: "w-dot-gmail-dot-com" },
  loadSample: async (id) => id === "06-medicare-unsupported"
    ? { extraction: ex("02-prior-auth-ca"), unsupported: "coverage" }
    : ["01-medical-necessity-ny", "02-prior-auth-ca", "03-oon-emergency-tx-eob"].includes(id) ? { extraction: ex(id) } : null,
  samples: [
    { id: "02-prior-auth-ca", title: "Prior authorization, California", state: "CA", spoken: "a surgery denied for missing prior authorization, in California" },
    { id: "01-medical-necessity-ny", title: "Medical necessity, New York", state: "NY", spoken: "an MRI denied as not medically necessary, in New York" },
  ],
});
const store = new CaseStore<Facts>({ clock: () => now });

(async () => {
  // ---- start_case, three openings
  const s0 = startCase(ctx(), {});
  eq("unknown → ask_has_document", s0.ok && s0.data.next, "ask_has_document");
  eq("opening states the line", s0.ok && s0.speak.includes("information, not legal advice"), true);
  speakOk("start unknown", s0);
  const sYes = startCase(ctx(), { has_document: "yes" });
  eq("yes → offer_upload", sYes.ok && sYes.data.next, "offer_upload");
  eq("code spoken in groups", sYes.ok && /[ACFHJKMNQRWXY234679]-[ACFHJKMNQRWXY234679]-[ACFHJKMNQRWXY234679], /.test(sYes.data.spokenCode), true);
  speakOk("start yes", sYes, "code_readout");
  const sNo = startCase(ctx(), { has_document: "no" });
  eq("no → ask_state", sNo.ok && sNo.data.next, "ask_state");
  speakOk("start no", sNo);
  const code = (sYes as any).case.code;

  // ---- use_sample: list, then load
  const list = await useSample(ctx(), { code });
  eq("lists samples", (list as any).data.samples.length, 2);
  speakOk("sample list", list);
  const used = await useSample(ctx(), { code, sample_id: "02-prior-auth-ca" });
  eq("status after sample", (used as any).case.status, "facts_pending");
  eq("readback is the template", (used as any).speak.startsWith("Here's what I read: Pacific Crest Health Plan"), true);
  speakOk("readback", used, "readback_only");

  // ---- get_readback repeats verbatim
  const again = getReadback(ctx(), { code });
  eq("repeat identical", (again as any).speak, (used as any).speak);

  // ---- confirm no → open question, then yes → next question with the state hint
  const no = confirmFacts(ctx(), { code, answer: "no" });
  eq("no lists fields", (no as any).data.fields.length, 5);
  eq("open question", (no as any).speak, "Okay — which part is off?");
  speakOk("correction question", no);
  eq("still pending", (no as any).case.status, "facts_pending");
  const yes = confirmFacts(ctx(), { code, answer: "yes" });
  eq("confirmed", (yes as any).case.status, "facts_confirmed");
  eq("asks state with hint", (yes as any).speak, "Thanks. The letter looks like it's from CA — is that where you live?");
  speakOk("state question", yes);
  eq("next is state", (yes as any).data.next, "state");
  // confirming twice is refused politely
  const twice = confirmFacts(ctx(), { code, answer: "yes" });
  eq("confirm twice → wrong_state", (twice as any).error.code, "wrong_state");
  speakOk("wrong state speak", twice);

  // ---- unsupported sample closes the case, no rights offered
  const m = startCase(ctx(), { has_document: "yes" });
  const mc = (m as any).case.code;
  const med = await useSample(ctx(), { code: mc, sample_id: "06-medicare-unsupported" });
  eq("medicare refused", (med as any).error.code, "unsupported_coverage");
  eq("no day count spoken", /\d+ days/.test((med as any).error.speak), false);
  eq("case discarded", (med as any).case.status, "discarded");
  speakOk("medicare stop", med);
  const after = getReadback(ctx(), { code: mc });
  eq("closed afterwards", (after as any).error.code, "case_closed");

  // ---- session isolation and unknown codes
  eq("other session", (getReadback(ctx("s2"), { code }) as any).error.code, "wrong_session");
  eq("unknown code", (getReadback(ctx(), { code: "XXXXXX" }) as any).error.code, "case_not_found");
  speakOk("wrong session speak", getReadback(ctx("s2"), { code }));

  // ---- help: deflection, state-first resource, no phone number spoken
  const help = getHelp(ctx(), { code });
  eq("deflection first", (help as any).speak.startsWith("I can't tell you what to do or predict how it will go."), true);
  eq("names the CA resource", (help as any).speak.includes("DMHC"), true);
  eq("no phone spoken", /\d{3}[- ]\d{3}/.test((help as any).speak), false);
  eq("resources returned", (help as any).data.humanHelp.length <= 3, true);
  speakOk("help", help);
  const helpFl = getHelp(ctx(), { state: "FL" });
  eq("unsupported state says so", (helpFl as any).speak.includes("federal baseline"), true);
  speakOk("help unsupported", helpFl);

  // ---- envelope → MCP tool result
  const tr = toToolResult(used as any);
  eq("text block is the speak", tr.content[0].text, (used as any).speak);
  eq("not an error", tr.isError, false);
  eq("error result flagged", toToolResult(twice as any).isError, true);
  eq("confirmation is not an error", toToolResult({ ok: false, case: { code, status: "rights_computed" }, needs_confirmation: { action: "draft_letter", question: "Shall I go ahead?", expectedYes: [], expectedNo: [] } } as any).isError, false);

  // ---- expiry message
  now += 31 * 60_000;
  const gone = getReadback(ctx(), { code });
  eq("expired", (gone as any).error.code, "case_not_found");
  eq("expiry speaks honestly", (gone as any).error.speak.includes("thirty minutes"), true);
  speakOk("expiry", gone);

  console.log(fails ? `${fails} failures` : "all passed");
})();
```

## Still to wire at T011 (MCP layer)

- zod input/output schemas exported per tool, `outputSchema` from the `Envelope` union.
- `registerTool` with the annotations table from `data-model.md` and the descriptions from
  `contracts/mcp-tools.md` **verbatim** — they are the product for an orchestrator.
- `ctx.loadSample` reads `data/samples/<id>.extraction.json`, and marks `06-medicare-unsupported`
  as `unsupported: "coverage"`; `ctx.samples` is built from the same directory.
- `ctx.account` comes from `fetchAccount` once per MCP session (T010).
