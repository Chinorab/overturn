import type { Extraction } from "@/lib/schemas/extraction";
import type { Situation } from "@/lib/schemas/situation";
import type { Answers } from "@/lib/session";
import { toISO } from "@/lib/rules/deadlines";

export const todayISO = () => toISO(new Date());

/**
 * Before the user has answered anything, we can still show the one deadline that
 * depends only on the letter date: the federal internal-appeal window. Everything
 * else waits for real answers; nothing here is a guess the user did not make.
 */
export function provisionalSituation(ex: Extraction, today = todayISO()): Situation | null {
  const letter = ex.letter_date.value;
  if (!letter) return null;
  return {
    extraction: ex,
    state: ex.state_hint.value ?? "NY", // irrelevant for the federal preview; never shown
    plan_source: "other",
    self_funded: "unknown",
    emergency: ex.emergency_signals.value ? "yes" : "unknown",
    urgent: ex.urgency_signals.value ? "yes" : "no",
    anchor_dates: { letter_date: letter },
    today,
  };
}

export function buildSituation(ex: Extraction, a: Answers, today = todayISO()): Situation | null {
  const letter = ex.letter_date.value;
  if (!letter) return null;
  return {
    extraction: ex,
    state: a.state,
    plan_source: a.plan_source,
    self_funded: a.self_funded,
    emergency: a.emergency,
    urgent: a.urgent,
    anchor_dates: { letter_date: letter, final_internal_denial_date: a.final_internal_denial_date },
    today,
  };
}
