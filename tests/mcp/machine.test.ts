import { describe, expect, it } from "vitest";
import {
  ALLOWED_IN,
  CONSEQUENTIAL,
  STATUSES,
  confirmationQuestion,
  gate,
  next,
  nextQuestion,
  nextQuestionAfterStart,
  type Status,
  type ToolName,
} from "@/mcp/src/machine";
import { checkTurn } from "@/lib/voice/turn-check";

type GatedTool = Exclude<ToolName, "overturn_start_case">;

describe("the gate", () => {
  it("refuses everything but help once the case is closed", () => {
    expect(gate("overturn_get_readback", "sent", {}).kind).toBe("case_closed");
    // Someone who has just cancelled can still be pointed at a human.
    expect(gate("overturn_get_help", "discarded", {}).kind).toBe("proceed");
  });

  it("checks the status before it asks for confirmation", () => {
    // Otherwise a call in the wrong state would get a question it could then "answer",
    // and a yes would carry it past a check it never passed.
    expect(gate("overturn_draft_letter", "facts_pending", { confirmed: true }).kind).toBe("wrong_state");
    expect(gate("overturn_send_letter", "rights_computed", { confirmed: true }).kind).toBe("wrong_state");
    expect(gate("overturn_compute_rights", "facts_pending", {}).kind).toBe("wrong_state");
  });

  it("treats a missing confirmed and confirmed:false the same", () => {
    expect(gate("overturn_draft_letter", "rights_computed", {}).kind).toBe("needs_confirmation");
    expect(gate("overturn_send_letter", "letter_drafted", { confirmed: false }).kind).toBe("needs_confirmation");
  });

  it("lets a confirmed call through", () => {
    expect(gate("overturn_draft_letter", "rights_computed", { confirmed: true }).kind).toBe("proceed");
    // Re-drafting before sending is allowed: a person may want a change.
    expect(gate("overturn_draft_letter", "letter_drafted", { confirmed: true }).kind).toBe("proceed");
  });

  it("names the masked email in the send question, never the address", () => {
    const g = gate("overturn_send_letter", "letter_drafted", {}, { emailMaskedSpoken: "w-dot-gmail-dot-com" });
    expect(g.kind === "needs_confirmation" && g.question).toBe(
      "Shall I send it to your email ending in w-dot-gmail-dot-com?",
    );
  });

  it.each([...CONSEQUENTIAL].flatMap((t) => ALLOWED_IN[t as GatedTool].map((s) => [t, s] as const)))(
    "%s is gated in %s",
    (tool, status) => {
      expect(gate(tool as GatedTool, status, {}).kind).toBe("needs_confirmation");
    },
  );
});

describe("the confirmation questions", () => {
  it.each(["draft_letter", "send_letter", "discard_case"] as const)("%s is one speakable question", (action) => {
    const q = confirmationQuestion(action, { emailMaskedSpoken: "w-dot-gmail-dot-com" });
    // An ordinary turn that the assistant must also speak verbatim: the machine owns the words,
    // so the transcripts, the tests and what the person hears cannot drift apart.
    expect(checkTurn(q, { kind: "normal", expectedQuestion: q }).violations).toEqual([]);
    expect((q.match(/\?/g) ?? []).length).toBe(1);
  });
});

describe("transitions", () => {
  it("walks the happy path for a sample case", () => {
    let st: Status = next("overturn_start_case", "started", { hasDocument: "yes" });
    expect(st).toBe("awaiting_document");
    st = next("overturn_use_sample", st);
    expect(st).toBe("facts_pending");
    st = next("overturn_confirm_facts", st, { confirmed: "yes" });
    expect(st).toBe("facts_confirmed");
    st = next("overturn_answer", st);
    expect(st).toBe("facts_confirmed");
    st = next("overturn_compute_rights", st);
    expect(st).toBe("rights_computed");
    st = next("overturn_draft_letter", st);
    expect(st).toBe("letter_drafted");
    st = next("overturn_send_letter", st);
    expect(st).toBe("sent");
  });

  it("keeps a rejected read-back pending until it is confirmed again", () => {
    expect(next("overturn_confirm_facts", "facts_pending", { confirmed: "no" })).toBe("facts_pending");
    expect(next("overturn_answer", "facts_pending")).toBe("facts_pending");
  });

  it("walks the no-document path", () => {
    expect(next("overturn_start_case", "started", { hasDocument: "no" })).toBe("answering");
    expect(next("overturn_answer", "answering", { answersComplete: false })).toBe("answering");
    expect(next("overturn_answer", "answering", { answersComplete: true })).toBe("facts_pending");
    expect(nextQuestionAfterStart(undefined)).toBe("ask_has_document");
  });

  it("closes the case for a document it cannot help with", () => {
    // Medicare and the like: no rights, no letter, ever.
    expect(next("overturn_use_sample", "awaiting_document", { unsupported: true })).toBe("discarded");
  });

  it("leaves the status alone for the two read-only tools", () => {
    for (const status of STATUSES) {
      expect(next("overturn_get_readback", status)).toBe(status);
      expect(next("overturn_get_help", status)).toBe(status);
    }
  });
});

describe("question sequencing", () => {
  it("skips self_funded unless the plan comes from an employer", () => {
    // State law reaches marketplace and direct plans regardless, so the question buys nothing.
    expect(nextQuestion("document", { state: 1, plan_source: 1 }, { planSource: "marketplace", denialCategory: "prior_auth" })).toBe("emergency");
    expect(nextQuestion("document", { state: 1, plan_source: 1 }, { planSource: "employer", denialCategory: "medical_necessity" })).toBe("self_funded");
  });

  it("asks about an emergency only when the No Surprises Act could apply", () => {
    expect(
      nextQuestion("document", { state: 1, plan_source: 1, self_funded: 1 }, { planSource: "employer", denialCategory: "medical_necessity" }),
    ).toBe("urgent");
    expect(
      nextQuestion("document", { state: 1, plan_source: 1, self_funded: 1 }, { planSource: "employer", denialCategory: "out_of_network" }),
    ).toBe("emergency");
  });

  it("asks the no-document questions in order", () => {
    const order = ["state", "plan_source", "self_funded", "denial_category", "document_date", "urgent"];
    const asked = order.map((_, i) =>
      nextQuestion("no_document", Object.fromEntries(order.slice(0, i).map((k) => [k, 1])), { planSource: "employer" }),
    );
    expect(asked).toEqual(order);
  });

  it("ends each path where that path should end", () => {
    expect(
      nextQuestion("document", { state: 1, plan_source: 1, self_funded: 1, urgent: 1 }, { planSource: "employer", denialCategory: "medical_necessity" }),
    ).toBe("compute_rights");
    // The no-document path has no read-back yet, so it has to confirm what it was told.
    expect(
      nextQuestion(
        "no_document",
        { state: 1, plan_source: 1, self_funded: 1, denial_category: 1, document_date: 1, urgent: 1 },
        { planSource: "employer" },
      ),
    ).toBe("confirm_facts");
  });
});

describe("the tool table", () => {
  it("gives every open status at least one tool that runs in it", () => {
    for (const status of STATUSES) {
      if (status === "sent" || status === "discarded") continue;
      const usable = Object.entries(ALLOWED_IN).filter(([, allowed]) => allowed.includes(status));
      expect(usable.length, `nothing can run in ${status}`).toBeGreaterThan(0);
    }
  });

  it("lets the case be abandoned from every open status", () => {
    for (const status of STATUSES) {
      if (status === "sent" || status === "discarded") continue;
      expect(ALLOWED_IN.overturn_discard_case.includes(status), `cannot cancel from ${status}`).toBe(true);
    }
  });
});
