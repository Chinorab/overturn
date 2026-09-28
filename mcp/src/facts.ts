/**
 * What a case knows. Everything here lives in memory for the life of the case and is freed the
 * moment the case is sent, discarded or expires (FR-040).
 *
 * The fields mirror the Case table in `specs/002-alexa-voice-mcp/data-model.md`, minus the ones
 * the store record already carries (code, session, status, path, account, timestamps). Types are
 * feature-001's: the voice path and the web path reason about the same objects, and there is one
 * rules engine underneath both.
 */
import type { Answers, Situation } from "@/lib/schemas/situation";
import type { Extraction } from "@/lib/schemas/extraction";
import type { LetterDraft } from "@/lib/schemas/letter";
import type { RightsResult } from "@/lib/rules/engine";
import type { Readback } from "@/lib/voice/readback";

/** The outcome of sending the letter. Filled in at T020; the case is closed either way. */
export type Delivery = {
  channel: "email" | "download_link";
  at: string;
  /** Masked, never the address itself — no tool returns an email. */
  toMasked: string | null;
};

export type CaseFacts = {
  extraction: Extraction | null;
  answers: Partial<Answers>;
  /** Set only on the no-document path. Its presence is what makes the deadlines approximate. */
  approxDocumentDate: string | null;
  situation: Situation | null;
  /** Computed once from confirmed facts and never edited: the letter cites what is in here. */
  rights: RightsResult | null;
  readbacks: Array<{ readback: Readback; confirmed: "yes" | "no" | null }>;
  letter: LetterDraft | null;
  delivery: Delivery | null;
};

export function emptyFacts(): CaseFacts {
  return {
    extraction: null,
    answers: {},
    approxDocumentDate: null,
    situation: null,
    rights: null,
    readbacks: [],
    letter: null,
    delivery: null,
  };
}
