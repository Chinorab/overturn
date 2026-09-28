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
