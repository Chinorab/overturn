# Turn-shape checker — executable contract (T019)

`lib/voice/turn-check.ts` is the deterministic guard between the orchestrator's text and the
speaker. It enforces FR-001 (one question, ≤ 4 options), FR-002 (≤ 60 words; ≤ 120 for a rights
chunk), and Constitution I (no prescriptive or predictive language) — and it exempts the one
phrase the persona is *required* to say, which the letter guard would otherwise flag
(`docs/transcripts/README.md`, finding 1). Pure, dependency-free, shared by the server (to
validate `speak` templates in tests), the simulator (post-check on every turn), and the golden
transcript test.

Copy the two blocks into `lib/voice/turn-check.ts` and `tests/voice/turn-check.test.ts`.

## Rules, stated once

| # | Rule | Applies to | Violation code |
|---|---|---|---|
| 1 | Exactly one question mark; the question is the last sentence, or is followed by **one** hint sentence of ≤ 10 words ("You can say I don't know.") | every turn except `closing` and `readback_only` (0 questions allowed) | `too_many_questions`, `question_not_last`, `missing_question` |
| 2 | ≤ 60 words | `normal` | `too_long` |
| 2b | ≤ 120 words | `rights_chunk` | `too_long` |
| 3 | ≤ 4 options when the question offers a list ("A, B, or C?") | every question | `too_many_options` |
| 4 | No prescriptive / predictive phrase (patterns from `lib/ai/guard.ts`), **except** the disclaimer forms "not legal advice", "isn't legal advice", "information, not legal advice" | every turn | `advice_language` |
| 5 | No URL, no email address, no long identifier (≥ 7 consecutive alphanumerics with digits, e.g. member IDs, claim numbers) unless the turn kind is `code_readout` | every turn | `spoken_url`, `spoken_email`, `spoken_identifier` |
| 6 | No exclamation mark; no banned openers ("Great question", "Absolutely", "I'd be happy to") | every turn | `tone` |
| 7 | `needs_confirmation` turns must equal the question verbatim (whitespace-normalized) | when `expectedQuestion` is given | `confirmation_not_verbatim` |

Policy on violation (in the orchestrator, not in this module): regenerate once with the violation
list appended to the prompt; if still violating, **repair** deterministically — truncate to the
first question (rule 1), truncate at the last sentence boundary under the limit (rule 2), strip
exclamation marks and banned openers (rule 6). Rules 4, 5 and 7 are never repaired: the turn is
replaced by the tool's own `speak` (or the verbatim question) and the violation is counted.
Every violation is emitted as a `violation` event and summed for SC-005.

## `lib/voice/turn-check.ts`

```ts
/**
 * Deterministic shape check for one spoken assistant turn.
 * Pure: no I/O, no model. Same code runs in the server tests, the simulator's post-check,
 * and the golden transcript replay.
 */

export type TurnKind =
  | "normal"          // any ordinary turn: ≤ 60 words, exactly one question, last
  | "rights_chunk"    // a chunk from overturn_compute_rights: ≤ 120 words, one question
  | "code_readout"    // the case code turn: identifiers allowed
  | "closing"         // the final turn after send/discard/stop: no question required, ≤ 60 words
  | "readback_only";  // a read-back re-spoken on "repeat": question expected (it ends with "Is that right?")

export type ViolationCode =
  | "too_many_questions" | "question_not_last" | "missing_question" | "too_long" | "too_many_options"
  | "advice_language" | "spoken_url" | "spoken_email" | "spoken_identifier" | "tone" | "confirmation_not_verbatim";

export type Violation = { code: ViolationCode; detail: string };

export type CheckOptions = {
  kind?: TurnKind;
  /** When the tool returned needs_confirmation, the exact question the turn must be. */
  expectedQuestion?: string;
};

export type CheckResult = { ok: boolean; violations: Violation[]; words: number; questions: number; options: number };

export const LIMITS: Record<TurnKind, { words: number; questions: [number, number] }> = {
  normal:        { words: 60,  questions: [1, 1] },
  rights_chunk:  { words: 120, questions: [1, 1] },
  code_readout:  { words: 60,  questions: [0, 1] },
  closing:       { words: 60,  questions: [0, 0] },
  readback_only: { words: 60,  questions: [1, 1] },
};

/** Same patterns as lib/ai/guard.ts (kept in sync by tests/voice/turn-check.test.ts). */
const PRESCRIPTIVE: RegExp[] = [
  /\byou (should|must|need to|have to|ought to)\b/i,
  /\bi (recommend|advise|suggest)\b/i,
  /\bwe (recommend|advise)\b/i,
  /\bguaranteed\b/i,
  /\b(will|would|going to) (win|succeed|prevail|be (overturned|reversed|approved))\b/i,
  /\blegal advice\b/i,
  /\byour (best|only) option\b/i,
  /\bstrong(ly)? (case|claim)\b/i,
];

/** The disclaimer the persona must say; removed before the advice scan. */
const DISCLAIMER_FORMS = /\b(information,? not legal advice|not legal advice|isn't legal advice|is not legal advice|rather than legal advice)\b/gi;

const HINT_MAX_WORDS = 10;
const BANNED_OPENERS = /^(great question|absolutely|i'd be happy to|certainly|of course|sure thing)\b/i;
const URL_RE = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|org|gov|net|edu)\b/i;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/;
/** ≥ 7 alphanumerics containing at least one digit and one letter, or ≥ 9 digits: member/claim numbers, phone numbers. */
const IDENTIFIER_RE = /\b(?=[A-Z0-9-]*\d)(?=[A-Z0-9-]*[A-Z])[A-Z0-9-]{7,}\b|\b\d[\d -]{8,}\d\b/;

const normalize = (s: string) => s.replace(/\s+/g, " ").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

export const countWords = (s: string) => normalize(s).split(" ").filter((w) => /[A-Za-z0-9]/.test(w)).length;

/** Split on sentence terminators, keeping the terminator. Em-dashes and semicolons do not split. */
export function sentences(s: string): string[] {
  return normalize(s).match(/[^.!?]+[.!?]+["')]?|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [];
}

/** Options offered by a question: "A, B, or C?" → 3; "yes or no?" → 2; no list → 0. */
export function countOptions(question: string): number {
  const q = question.replace(/\?$/, "");
  const orIdx = q.search(/\sor\s/);
  if (orIdx < 0) return 0;
  // Take the clause after the last dash/colon/"—" if any, so "how do you get it — A, B, or C" counts only the list.
  const clause = q.split(/\s[—:–]\s/).pop()!;
  const parts = clause.split(/,\s*|\sor\s/).map((p) => p.trim()).filter(Boolean);
  return parts.length;
}

export function checkTurn(text: string, opts: CheckOptions = {}): CheckResult {
  const kind = opts.kind ?? "normal";
  const limits = LIMITS[kind];
  const v: Violation[] = [];
  const t = normalize(text);
  const sents = sentences(t);
  const words = countWords(t);
  const qs = sents.filter((s) => s.endsWith("?") || s.endsWith('?"'));
  const questions = qs.length;

  // 1. question count and position
  if (questions > limits.questions[1]) v.push({ code: "too_many_questions", detail: `${questions} questions` });
  if (questions < limits.questions[0]) v.push({ code: "missing_question", detail: "turn must end with one question" });
  if (questions >= 1) {
    const lastQ = sents.findLastIndex((s) => s.endsWith("?") || s.endsWith('?"'));
    const trailing = sents.slice(lastQ + 1);
    // One short hint after the question is allowed ("You can say I don't know."), nothing more.
    const hintOk = trailing.length === 0 || (trailing.length === 1 && countWords(trailing[0]) <= HINT_MAX_WORDS);
    if (!hintOk) v.push({ code: "question_not_last", detail: `after the question: "${trailing.join(" ")}"` });
  }

  // 2. length
  if (words > limits.words) v.push({ code: "too_long", detail: `${words} words > ${limits.words}` });

  // 3. options
  const options = questions ? countOptions(qs.at(-1)!) : 0;
  if (options > 4) v.push({ code: "too_many_options", detail: `${options} options` });

  // 4. advice language, with the disclaimer exempted
  const scanned = t.replace(DISCLAIMER_FORMS, "");
  for (const re of PRESCRIPTIVE) {
    const m = scanned.match(re);
    if (m) v.push({ code: "advice_language", detail: m[0] });
  }

  // 5. things that must not be spoken
  if (URL_RE.test(t)) v.push({ code: "spoken_url", detail: t.match(URL_RE)![0] });
  if (EMAIL_RE.test(t)) v.push({ code: "spoken_email", detail: t.match(EMAIL_RE)![0] });
  if (kind !== "code_readout" && IDENTIFIER_RE.test(t)) v.push({ code: "spoken_identifier", detail: t.match(IDENTIFIER_RE)![0] });

  // 6. tone
  if (/!/.test(t)) v.push({ code: "tone", detail: "exclamation mark" });
  if (BANNED_OPENERS.test(t)) v.push({ code: "tone", detail: t.match(BANNED_OPENERS)![0] });

  // 7. verbatim confirmation
  if (opts.expectedQuestion && normalize(opts.expectedQuestion).toLowerCase() !== t.toLowerCase()) {
    v.push({ code: "confirmation_not_verbatim", detail: `expected "${normalize(opts.expectedQuestion)}"` });
  }

  return { ok: v.length === 0, violations: v, words, questions, options };
}

/** Deterministic repair for the repairable rules (1, 2, 6). Never touches rules 4, 5, 7. */
export function repairTurn(text: string, opts: CheckOptions = {}): string {
  const kind = opts.kind ?? "normal";
  const limits = LIMITS[kind];
  let sents = sentences(text).map((s) => s.replace(/!/g, "."));
  if (sents.length && BANNED_OPENERS.test(sents[0])) {
    sents[0] = sents[0].replace(BANNED_OPENERS, "").replace(/^[,.!\s]+/, "");
    if (!sents[0]) sents.shift();
  }
  // keep everything up to and including the first question; drop later questions
  const firstQ = sents.findIndex((s) => s.endsWith("?"));
  if (firstQ >= 0 && limits.questions[1] === 1) sents = sents.slice(0, firstQ + 1);
  // shrink from the front (keep the question) until under the word limit
  while (sents.length > 1 && countWords(sents.join(" ")) > limits.words) sents.splice(sents.length - 2, 1);
  return sents.join(" ");
}
```

## `tests/voice/turn-check.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { checkTurn, countOptions, repairTurn, sentences } from "@/lib/voice/turn-check";
import { findPrescriptive } from "@/lib/ai/guard";

const ok = (t: string, o = {}) => expect(checkTurn(t, o).violations).toEqual([]);
const bad = (t: string, code: string, o = {}) => expect(checkTurn(t, o).violations.map((v) => v.code)).toContain(code);

describe("questions", () => {
  it("accepts exactly one question, last", () => ok("Thanks. The letter looks like it's from California — is that where you live?"));
  it("rejects two questions", () => bad("Is that right? And where do you live?", "too_many_questions"));
  it("allows one short hint after the question", () => ok("Do you know if the plan is self-funded? You can say I don't know."));
  it("rejects a long sentence after the question", () => bad("Is that right? I read the letter carefully and found several other things we should talk about.", "question_not_last"));
  it("rejects no question on a normal turn", () => bad("I read your letter and it looks fine.", "missing_question"));
  it("allows no question on a closing turn", () => ok("Sent. I've kept nothing on my side. Take care.", { kind: "closing" }));
  it("rejects two sentences after the question", () => bad('Is that right? Say yes when ready. Then we continue with the next part of your case.', "question_not_last"));
});

describe("length", () => {
  const w = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  it("accepts 60 words", () => ok(`${w(59)} ok?`));
  it("rejects 61 words", () => bad(`${w(60)} ok?`, "too_long"));
  it("accepts 120 words on a rights chunk", () => ok(`${w(119)} more?`, { kind: "rights_chunk" }));
  it("rejects 121 words on a rights chunk", () => bad(`${w(120)} more?`, "too_long", { kind: "rights_chunk" }));
});

describe("options", () => {
  it("counts a three-item list", () => expect(countOptions("How do you get your coverage — through an employer, the Marketplace, or bought directly?")).toBe(3));
  it("counts yes or no as two", () => expect(countOptions("Was that yes or no?")).toBe(2));
  it("counts zero when there is no list", () => expect(countOptions("Which state do you live in?")).toBe(0));
  it("rejects five options", () => bad("Which one — A, B, C, D, or E?", "too_many_options"));
  it("accepts four", () => ok("What reason did they give — not medically necessary, no prior authorization, out of network, or something else?"));
});

describe("advice language", () => {
  it("exempts the mandated disclaimer", () =>
    ok("I can help you understand the denial and prepare an appeal letter — that's information, not legal advice. Do you have the letter in front of you?"));
  it("still flags a claim to give legal advice", () => bad("I can give you legal advice on this. Shall we start?", "advice_language"));
  it("flags you should", () => bad("You should appeal this right away. Ready?", "advice_language"));
  it("flags predictions", () => bad("You will win this one. Ready?", "advice_language"));
  it("does not flag the NY fee rule's wording", () => ok("The fee is at most twenty-five dollars, refunded if you win it. Shall I draft the letter?", { kind: "rights_chunk" }));
  it("stays in sync with lib/ai/guard.ts", () => {
    // every guard hit on a non-disclaimer sentence must also be a turn-check hit
    const samples = ["You must file now. Ready?", "I recommend appealing. Ready?", "This is guaranteed. Ready?", "Your best option is to wait. Ready?", "You have a strong case. Ready?"];
    for (const s of samples) { expect(findPrescriptive(s).length).toBeGreaterThan(0); bad(s, "advice_language"); }
  });
});

describe("things never spoken", () => {
  it("flags a URL", () => bad("Read more at www.dmhc.ca.gov. Okay?", "spoken_url"));
  it("flags an email", () => bad("I'll send it to walter@example.com. Okay?", "spoken_email"));
  it("flags a member ID on a normal turn", () => bad("Your member ID is PCH-5590213. Okay?", "spoken_identifier"));
  it("flags a phone number", () => bad("Call 1-800-555-0130. Okay?", "spoken_identifier"));
  it("allows the case code on a code readout", () => ok("Enter this code: A-C-F, 3-4-7. Tell me when it's in?", { kind: "code_readout" }));
  it("allows a masked email", () => ok("Shall I send it to your email ending in w-dot-gmail-dot-com?"));
  it("allows dates and money in words", () => ok("Your first deadline is March 10th, 2027 — 140 days from today. Want more?"));
});

describe("tone", () => {
  it("flags exclamation marks", () => bad("Great, it's uploaded! Is that right?", "tone"));
  it("flags banned openers", () => bad("Absolutely, I can help. Do you have the letter?", "tone"));
});

describe("verbatim confirmation", () => {
  const q = "Shall I send it to your email ending in w-dot-gmail-dot-com?";
  it("accepts the exact question", () => ok(q, { expectedQuestion: q }));
  it("rejects a paraphrase", () => bad("Want me to email it to you?", "confirmation_not_verbatim", { expectedQuestion: q }));
});

describe("repair", () => {
  it("keeps only the first question", () => expect(repairTurn("Is that right? Where do you live?")).toBe("Is that right?"));
  it("drops sentences before the question until under the limit", () => {
    const long = Array.from({ length: 8 }, (_, i) => `Sentence number ${i} has exactly seven words here.`).join(" ") + " Is that right?";
    const r = repairTurn(long);
    expect(checkTurn(r).ok).toBe(true);
    expect(r.endsWith("Is that right?")).toBe(true);
  });
  it("removes exclamation marks and banned openers", () => expect(repairTurn("Absolutely! It's in! Is that right?")).toBe("It's in. Is that right?"));
});

describe("golden transcripts replay", () => {
  // Every assistant turn in docs/transcripts/*.md passes; the turn kind is inferred from the transcript:
  // a bracketed count > 60 marks a rights chunk, "(continued)" / "kept nothing" marks a closing, "enter this code" a code readout.
  const dir = "docs/transcripts";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md")) {
    it(f, () => {
      const lines = readFileSync(`${dir}/${f}`, "utf8").split("\n");
      for (const line of lines) {
        const m = line.match(/^A: (.*?)\s*\[(\d+)\]\s*$/);
        if (!m) continue;
        const text = m[1].replace(/\*\(.*?\)\*/g, "").trim();
        const kind = /^Sent\.|kept nothing|Nothing was saved/i.test(text) ? "closing"
          : /enter this code/i.test(text) ? "code_readout"
          : Number(m[2]) > 60 ? "rights_chunk" : "normal";
        const r = checkTurn(text, { kind });
        expect(r.violations, `${f}: "${text.slice(0, 50)}…"`).toEqual([]);
        expect(r.words).toBe(Number(m[2]));
      }
    });
  }
});
```

## Known limits (accepted)

- Question detection is punctuation-based. A turn that asks without a question mark ("Tell me
  when it's in.") counts as no question — which is what we want for hand-offs, but the persona
  must then end code-readout turns with either a `?` or a hand-off, never both.
- `countOptions` is a heuristic for "A, B, or C" lists; a question like "employer or Marketplace,
  or did you buy it directly?" counts 3, fine; a comma inside an option ("New York, New York")
  over-counts — acceptable, it only ever errs on the strict side.
- Word counts: whitespace tokens that contain at least one letter or digit ("—" is not a word;
  "w-dot-gmail-dot-com" and "A-C-F," are one word each). The transcript counts were computed with
  the same rule, so the replay assertion `r.words === bracket` holds.
