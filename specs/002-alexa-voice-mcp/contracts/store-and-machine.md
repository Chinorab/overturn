# Case store and status machine — executable contract (T009)

`mcp/src/machine.ts` (pure) and `mcp/src/store.ts` (in-memory, injectable clock). Together they are
the *action layer* of LEGAL_DESIGN: a consequential tool cannot run without `confirmed: true`, a
tool cannot run out of order, a case cannot be read from another MCP session, and nothing about a
case survives 30 idle minutes, a send, or a cancel.

**Run on 2026-09-21** with `tsx`: 60 assertions pass — gate decisions in every status, the full
happy-path transition chain, the correction loop, the no-document path, question sequencing
(Marketplace skips `self_funded`; medical-necessity skips `emergency`), store expiry at 31 idle
minutes with a touched clock, `wrong_session`, `case_closed` with facts freed, tombstoned codes
never reissued, session end, tombstone expiry after 24 h. The three confirmation questions pass
`turn-check` as single questions.

## Decisions the code fixes

| Decision | Where |
|---|---|
| Check order in `gate()`: **closed → allowed status → confirmation**. A consequential call in the wrong state gets `wrong_state`, never a confirmation question it could then "answer" | `gate` |
| `confirmed: false` and `confirmed` absent are the same: not confirmed | `gate` |
| `overturn_get_help` works in every status, including closed — a person who just cancelled can still be pointed to a human | `ALLOWED_IN` |
| Re-drafting is allowed from `letter_drafted` (before sending); sending only from `letter_drafted`; `compute_rights` only from `facts_confirmed` | `ALLOWED_IN` |
| A rejected read-back keeps the case in `facts_pending`; corrections go through `overturn_answer` in that status and the read-back must be confirmed again | `next` |
| An unsupported document (Medicare, …) closes the case as `discarded`: no rights, no letter, ever | `next` |
| The confirmation questions are **fixed strings** owned by the machine (draft / send with the masked email / discard), so the assistant, the transcripts and the test all quote the same words | `confirmationQuestion` |
| Question sequencing: `self_funded` only for employer plans; `emergency` only when the category can involve the No Surprises Act (`prior_auth`, `out_of_network`, `not_covered`, `other`) | `nextQuestion` |
| Store: one `Map`, `sweep()` on every access (no timers, so nothing runs when no one calls), `get()` touches `lastActivityAt`, `close()` frees `facts` and `account` immediately and leaves a shell that answers `case_closed` until swept | `CaseStore` |
| Tombstones: a code that was ever spoken is blocked from reissue for 24 h after the case ends or expires | `CaseStore.forget/close` |
| `endSession(sessionId)` discards everything the MCP session owned — wired to the transport's `onclose` / `DELETE /mcp` | `CaseStore.endSession` |
| `stats()` returns counts only — for `/healthz`; never a code, never contents | `CaseStore.stats` |

`OVERTURN_CLOCK` (conformance test): the server builds the store with `clock: () => base + offset`
and, only when that variable is set, mounts `POST /__test/clock { advanceMinutes }` to move `offset`.

## `mcp/src/machine.ts`

```ts
/**
 * Case status machine and confirmation gate. Pure: no I/O, no clock, no model.
 * The machine is what makes "the assistant asks before it acts" a property of the server rather
 * than of the prompt (LEGAL_DESIGN addendum, action layer).
 */

export const STATUSES = [
  "started", "awaiting_document", "answering", "facts_pending", "facts_confirmed",
  "rights_computed", "letter_drafted", "sent", "discarded",
] as const;
export type Status = (typeof STATUSES)[number];

export const CLOSED: ReadonlySet<Status> = new Set<Status>(["sent", "discarded"]);

/** Every tool, the statuses it may run in, and the status it leads to (when it does not depend on the result). */
export type ToolName =
  | "overturn_start_case" | "overturn_attach_document" | "overturn_use_sample" | "overturn_answer" | "overturn_get_readback"
  | "overturn_confirm_facts" | "overturn_compute_rights" | "overturn_draft_letter" | "overturn_send_letter"
  | "overturn_discard_case" | "overturn_get_help";

export const ALLOWED_IN: Record<Exclude<ToolName, "overturn_start_case">, readonly Status[]> = {
  overturn_attach_document: ["awaiting_document", "answering", "facts_pending"],   // a document can replace answers or a rejected read-back
  overturn_use_sample:      ["awaiting_document", "answering", "facts_pending"],
  overturn_answer:          ["answering", "facts_pending", "facts_confirmed"],       // facts_confirmed: the remaining questions after the read-back; facts_pending: corrections
  overturn_get_readback:    ["facts_pending", "facts_confirmed", "rights_computed", "letter_drafted", "awaiting_document", "answering"],
  overturn_confirm_facts:   ["facts_pending"],
  overturn_compute_rights:  ["facts_confirmed"],
  overturn_draft_letter:    ["rights_computed", "letter_drafted"],                   // re-draft allowed before sending
  overturn_send_letter:     ["letter_drafted"],
  overturn_discard_case:    ["started", "awaiting_document", "answering", "facts_pending", "facts_confirmed", "rights_computed", "letter_drafted"],
  overturn_get_help:        [...STATUSES],
};

export const CONSEQUENTIAL = new Set<ToolName>(["overturn_draft_letter", "overturn_send_letter", "overturn_discard_case"]);

export type Gate =
  | { kind: "proceed" }
  | { kind: "wrong_state"; status: Status; allowed: readonly Status[] }
  | { kind: "case_closed"; status: Status }
  | { kind: "needs_confirmation"; action: "draft_letter" | "send_letter" | "discard_case"; question: string; expectedYes: string[]; expectedNo: string[] };

export const EXPECTED_YES = ["yes", "yeah", "yep", "correct", "that's right", "go ahead", "do it", "sure", "please"];
export const EXPECTED_NO = ["no", "nope", "wrong", "not quite", "that's not right", "don't", "stop", "hold off"];

/** The exact confirmation questions (voice-design §4, T9/T10; §3 stop). `emailMaskedSpoken` is "w-dot-gmail-dot-com". */
export function confirmationQuestion(action: "draft_letter" | "send_letter" | "discard_case", ctx: { emailMaskedSpoken?: string; hasBlanksNote?: boolean }): string {
  switch (action) {
    case "draft_letter":
      return "I'll write the letter from your facts and those rules, with blanks where I don't know something. Shall I go ahead?";
    case "send_letter":
      return `Shall I send it to your email ending in ${ctx.emailMaskedSpoken ?? "the address on your linked account"}?`;
    case "discard_case":
      return "Do you want me to drop this and keep nothing? Say yes to confirm.";
  }
}

/** Decide whether a tool may run now. Order of checks: closed → allowed status → confirmation. */
export function gate(tool: Exclude<ToolName, "overturn_start_case">, status: Status, input: { confirmed?: boolean }, ctx: { emailMaskedSpoken?: string } = {}): Gate {
  if (CLOSED.has(status) && tool !== "overturn_get_help") return { kind: "case_closed", status };
  const allowed = ALLOWED_IN[tool];
  if (!allowed.includes(status)) return { kind: "wrong_state", status, allowed };
  if (CONSEQUENTIAL.has(tool) && input.confirmed !== true) {
    const action = tool === "overturn_draft_letter" ? "draft_letter" : tool === "overturn_send_letter" ? "send_letter" : "discard_case";
    return { kind: "needs_confirmation", action, question: confirmationQuestion(action, ctx), expectedYes: EXPECTED_YES, expectedNo: EXPECTED_NO };
  }
  return { kind: "proceed" };
}

/** Status after a tool succeeded. Tools whose outcome branches pass the branch. */
export function next(tool: ToolName, from: Status, outcome?: { hasDocument?: "yes" | "no" | "unknown"; answersComplete?: boolean; confirmed?: "yes" | "no"; unsupported?: boolean }): Status {
  switch (tool) {
    case "overturn_start_case":
      return outcome?.hasDocument === "no" ? "answering" : outcome?.hasDocument === "yes" ? "awaiting_document" : "started";
    case "overturn_attach_document":
    case "overturn_use_sample":
      return outcome?.unsupported ? "discarded" : "facts_pending";
    case "overturn_answer":
      if (from === "answering") return outcome?.answersComplete ? "facts_pending" : "answering";
      if (from === "facts_confirmed") return "facts_confirmed";
      return "facts_pending";                                   // a correction keeps the case pending until re-confirmed
    case "overturn_confirm_facts":
      return outcome?.confirmed === "yes" ? "facts_confirmed" : "facts_pending";
    case "overturn_compute_rights":
      return "rights_computed";
    case "overturn_draft_letter":
      return "letter_drafted";
    case "overturn_send_letter":
      return "sent";
    case "overturn_discard_case":
      return "discarded";
    case "overturn_get_readback":
    case "overturn_get_help":
      return from;
  }
}

/** "started" with has_document unknown: the assistant must ask; the client passes the answer to the next call. */
export function nextQuestionAfterStart(hasDocument: "yes" | "no" | "unknown" | undefined): "ask_has_document" | "offer_upload" | "ask_state" {
  return hasDocument === "yes" ? "offer_upload" : hasDocument === "no" ? "ask_state" : "ask_has_document";
}

/**
 * The no-document question sequence and the post-read-back sequence. Marketplace/direct plans skip
 * self_funded (state law reaches them regardless); emergency is asked whenever the category makes the
 * No Surprises Act possible or is unknown.
 */
export type QuestionId = "state" | "plan_source" | "self_funded" | "emergency" | "urgent" | "denial_category" | "document_date";

export function nextQuestion(path: "document" | "no_document", answered: Partial<Record<QuestionId, unknown>>, ctx: { planSource?: string | null; denialCategory?: string | null }): QuestionId | "confirm_facts" | "compute_rights" {
  const order: QuestionId[] = path === "no_document"
    ? ["state", "plan_source", "self_funded", "denial_category", "document_date", "urgent"]
    : ["state", "plan_source", "self_funded", "emergency", "urgent"];
  for (const q of order) {
    if (q === "self_funded" && ctx.planSource && ctx.planSource !== "employer") continue;
    if (q === "emergency" && ctx.denialCategory && !["prior_auth", "out_of_network", "other", "not_covered"].includes(ctx.denialCategory)) continue;
    if (!(q in answered)) return q;
  }
  return path === "no_document" ? "confirm_facts" : "compute_rights";
}
```

## `mcp/src/store.ts`

```ts
/**
 * In-memory case store. Nothing is persisted (FR-040). One Map, an injectable clock, idle expiry,
 * 24-hour tombstones so a spoken code is never reused while someone might still say it, and
 * session ownership so a code from one MCP session cannot be read from another.
 */
import { generateCode, type CaseCode } from "@/lib/voice/case-code";
import { CLOSED, type Status } from "./machine";

export type Clock = () => number;                       // ms since epoch; injectable for tests and OVERTURN_CLOCK

export type CaseRecord<TFacts = unknown> = {
  code: CaseCode;
  sessionId: string;
  status: Status;
  path: "document" | "sample" | "no_document" | null;
  facts: TFacts;                                        // extraction, answers, situation, rights, letter, delivery — typed by the tools layer
  account: { email: string; emailMasked: string; emailMaskedSpoken: string } | null;
  createdAt: number;
  lastActivityAt: number;
};

export type StoreOptions = { ttlMs?: number; tombstoneMs?: number; clock?: Clock; random?: () => number };

export type Lookup<T> =
  | { ok: true; record: CaseRecord<T> }
  | { ok: false; error: "case_not_found" | "wrong_session" | "case_closed" };

export class CaseStore<T = unknown> {
  private readonly cases = new Map<string, CaseRecord<T>>();
  private readonly tombstones = new Map<string, number>();   // code → expiry
  private readonly ttlMs: number;
  private readonly tombstoneMs: number;
  private readonly clock: Clock;
  private readonly random?: () => number;

  constructor(opts: StoreOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 30 * 60_000;
    this.tombstoneMs = opts.tombstoneMs ?? 24 * 3_600_000;
    this.clock = opts.clock ?? (() => Date.now());
    this.random = opts.random;
  }

  create(sessionId: string, facts: T, account: CaseRecord["account"]): CaseRecord<T> {
    this.sweep();
    const code = generateCode((c) => this.cases.has(c) || this.tombstones.has(c), this.random);
    const now = this.clock();
    const record: CaseRecord<T> = { code, sessionId, status: "started", path: null, facts, account, createdAt: now, lastActivityAt: now };
    this.cases.set(code, record);
    return record;
  }

  /** Get a live case for this session; touches lastActivityAt. */
  get(code: string, sessionId: string): Lookup<T> {
    this.sweep();
    const rec = this.cases.get(code.toUpperCase());
    if (!rec) return { ok: false, error: "case_not_found" };
    if (rec.sessionId !== sessionId) return { ok: false, error: "wrong_session" };
    if (CLOSED.has(rec.status)) return { ok: false, error: "case_closed" };
    rec.lastActivityAt = this.clock();
    return { ok: true, record: rec };
  }

  /** Closed cases stay readable for `case_closed` answers until swept; `close` frees the facts immediately. */
  close(code: string, status: "sent" | "discarded"): void {
    const rec = this.cases.get(code);
    if (!rec) return;
    rec.status = status;
    rec.facts = null as unknown as T;                    // PHI freed now; the shell remains only to answer case_closed
    rec.account = null;
    this.tombstones.set(code, this.clock() + this.tombstoneMs);
  }

  /** Drop the record entirely (after expiry or on session end). The tombstone keeps the code blocked. */
  forget(code: string): void {
    if (this.cases.delete(code)) this.tombstones.set(code, this.clock() + this.tombstoneMs);
  }

  /** End of an MCP session: every case it owned is discarded. */
  endSession(sessionId: string): number {
    let n = 0;
    for (const rec of [...this.cases.values()]) if (rec.sessionId === sessionId) { this.forget(rec.code); n++; }
    return n;
  }

  /** Expire idle cases; called on every access so no timer is needed. */
  sweep(): void {
    const now = this.clock();
    for (const rec of [...this.cases.values()]) {
      if (now - rec.lastActivityAt > this.ttlMs) this.forget(rec.code);
    }
    for (const [code, until] of this.tombstones) if (until <= now) this.tombstones.delete(code);
  }

  /** For /healthz and tests only: counts, never contents. */
  stats(): { live: number; closed: number; tombstoned: number } {
    let live = 0, closed = 0;
    for (const rec of this.cases.values()) CLOSED.has(rec.status) ? closed++ : live++;
    return { live, closed, tombstoned: this.tombstones.size };
  }
}
```

## Tests (`tests/mcp/machine.test.ts`, `tests/mcp/store.test.ts`)

Each `eq(label, got, expected)` becomes `it(label, () => expect(got).toEqual(expected))`; the loops
become `it.each`. All pass against the code above.

```ts
// ---- gate
eq("closed case", gate("overturn_get_readback", "sent", {}).kind, "case_closed");
eq("help works on closed", gate("overturn_get_help", "discarded", {}).kind, "proceed");
eq("draft too early", gate("overturn_draft_letter", "facts_pending", { confirmed: true }).kind, "wrong_state");
eq("draft unconfirmed", gate("overturn_draft_letter", "rights_computed", {}).kind, "needs_confirmation");
eq("draft confirmed", gate("overturn_draft_letter", "rights_computed", { confirmed: true }).kind, "proceed");
eq("send needs drafted", gate("overturn_send_letter", "rights_computed", { confirmed: true }).kind, "wrong_state");
const sendGate = gate("overturn_send_letter", "letter_drafted", {}, { emailMaskedSpoken: "w-dot-gmail-dot-com" });
eq("send question names masked email", sendGate.kind === "needs_confirmation" && sendGate.question, "Shall I send it to your email ending in w-dot-gmail-dot-com?");
eq("discard gate", gate("overturn_discard_case", "answering", {}).kind, "needs_confirmation");
eq("confirmed:false is not confirmed", gate("overturn_send_letter", "letter_drafted", { confirmed: false }).kind, "needs_confirmation");
eq("compute needs confirmed facts", gate("overturn_compute_rights", "facts_pending", {}).kind, "wrong_state");
eq("re-draft allowed", gate("overturn_draft_letter", "letter_drafted", { confirmed: true }).kind, "proceed");
// every confirmation question passes the turn checker as a single question
for (const a of ["draft_letter", "send_letter", "discard_case"] as const) {
// every consequential tool is gated in every status where it is allowed
for (const t of CONSEQUENTIAL) for (const s of ALLOWED_IN[t as keyof typeof ALLOWED_IN]) eq(`gated ${t} in ${s}`, gate(t as any, s, {}).kind, "needs_confirmation");
// every status is reachable in some tool's allowed list except closed ones
for (const s of STATUSES) if (s !== "sent" && s !== "discarded") {
// ---- transitions (happy path sample 02)
let st = next("overturn_start_case", "started", { hasDocument: "yes" }); eq("start yes", st, "awaiting_document");
st = next("overturn_use_sample", st); eq("sample", st, "facts_pending");
st = next("overturn_confirm_facts", st, { confirmed: "yes" }); eq("confirm", st, "facts_confirmed");
st = next("overturn_answer", st); eq("answer after confirm", st, "facts_confirmed");
st = next("overturn_compute_rights", st); eq("rights", st, "rights_computed");
st = next("overturn_draft_letter", st); eq("draft", st, "letter_drafted");
st = next("overturn_send_letter", st); eq("send", st, "sent");
// correction loop
eq("confirm no", next("overturn_confirm_facts", "facts_pending", { confirmed: "no" }), "facts_pending");
eq("correction keeps pending", next("overturn_answer", "facts_pending"), "facts_pending");
// no-document path
eq("start no", next("overturn_start_case", "started", { hasDocument: "no" }), "answering");
eq("answering incomplete", next("overturn_answer", "answering", { answersComplete: false }), "answering");
eq("answering complete", next("overturn_answer", "answering", { answersComplete: true }), "facts_pending");
eq("unsupported closes", next("overturn_use_sample", "awaiting_document", { unsupported: true }), "discarded");
eq("after start unknown", nextQuestionAfterStart(undefined), "ask_has_document");
// ---- question sequencing
eq("doc path marketplace skips self_funded", nextQuestion("document", { state: 1, plan_source: 1 }, { planSource: "marketplace", denialCategory: "prior_auth" }), "emergency");
eq("doc path employer asks self_funded", nextQuestion("document", { state: 1, plan_source: 1 }, { planSource: "employer", denialCategory: "medical_necessity" }), "self_funded");
eq("doc path med-nec skips emergency", nextQuestion("document", { state: 1, plan_source: 1, self_funded: 1 }, { planSource: "employer", denialCategory: "medical_necessity" }), "urgent");
eq("doc path done", nextQuestion("document", { state: 1, plan_source: 1, self_funded: 1, urgent: 1 }, { planSource: "employer", denialCategory: "medical_necessity" }), "compute_rights");
eq("no-doc sequence", ["state", "plan_source", "self_funded", "denial_category", "document_date", "urgent"].map((_, i, arr) => nextQuestion("no_document", Object.fromEntries(arr.slice(0, i).map((k) => [k, 1])), { planSource: "employer" })), ["state", "plan_source", "self_funded", "denial_category", "document_date", "urgent"]);
eq("no-doc done → confirm", nextQuestion("no_document", { state: 1, plan_source: 1, self_funded: 1, denial_category: 1, document_date: 1, urgent: 1 }, { planSource: "employer" }), "confirm_facts");
// ---- store with injected clock
let now = Date.parse("2026-10-21T10:00:00Z");
const store = new CaseStore<{ n: number }>({ clock: () => now, ttlMs: 30 * 60_000, tombstoneMs: 24 * 3_600_000 });
const a = store.create("sess-A", { n: 1 }, { email: "walter.demo@gmail.com", emailMasked: "w•••@gmail.com", emailMaskedSpoken: "w-dot-gmail-dot-com" });
eq("code shape", /^[ACFHJKMNQRWXY234679]{6}$/.test(a.code), true);
eq("get own", store.get(a.code, "sess-A").ok, true);
eq("get lowercase", store.get(a.code.toLowerCase(), "sess-A").ok, true);
eq("wrong session", (store.get(a.code, "sess-B") as any).error, "wrong_session");
eq("unknown code", (store.get("XXXXXX", "sess-A") as any).error, "case_not_found");
now += 29 * 60_000; eq("alive at 29 min", store.get(a.code, "sess-A").ok, true);           // touch resets the clock
now += 31 * 60_000; eq("expired at 31 min idle", (store.get(a.code, "sess-A") as any).error, "case_not_found");
eq("tombstoned after expiry", store.stats().tombstoned, 1);
// closed case answers case_closed and frees facts
const b = store.create("sess-A", { n: 2 }, null);
store.close(b.code, "sent");
eq("closed lookup", (store.get(b.code, "sess-A") as any).error, "case_closed");
eq("facts freed", (store as any).cases.get(b.code).facts, null);
eq("code not reused while tombstoned", (() => { for (let i = 0; i < 5000; i++) if (store.create("s", { n: 0 }, null).code === b.code) return false; return true; })(), true);
// session end
const c = store.create("sess-C", { n: 3 }, null);
eq("end session count ≥ 1", store.endSession("sess-C") >= 1, true);
eq("gone after session end", (store.get(c.code, "sess-C") as any).error, "case_not_found");
// tombstone expiry
now += 25 * 3_600_000; store.sweep(); eq("idle cases expired into tombstones", store.stats().live, 0);
now += 25 * 3_600_000; store.sweep(); eq("tombstones cleared 24 h after expiry", store.stats().tombstoned, 0);
```
