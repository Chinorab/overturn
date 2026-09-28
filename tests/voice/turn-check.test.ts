import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { checkTurn, countOptions, repairTurn } from "@/lib/voice/turn-check";
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
