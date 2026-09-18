"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Extraction, Explanation } from "@/lib/schemas/extraction";
import type { PlanSource, USStateCode, YesNoUnknown } from "@/lib/schemas/core";

/**
 * All state lives in the browser tab (React state mirrored to sessionStorage so a refresh
 * does not lose the work). Nothing is sent back to the server except what the next step
 * needs. Closing the tab forgets everything.
 */
export type Source = { kind: "sample"; id: string; title: string } | { kind: "upload"; name: string };

export type Answers = {
  state: USStateCode;
  plan_source: PlanSource;
  self_funded: YesNoUnknown;
  emergency: YesNoUnknown;
  urgent: "yes" | "no";
  final_internal_denial_date?: string;
};

export type LetterState = {
  sections: Array<{ id: string; heading?: string; text: string }>;
  placeholders: string[];
  cited_rule_ids: string[];
  checklist: Array<{ item: string; why: string }>;
  send_to: { address: string | null; source: "letter" | "generic"; verify_note: string };
  guard_report: { prescriptive_hits: string[]; unknown_citations: string[]; regenerated: boolean };
};

export type Session = {
  source: Source | null;
  extraction: Extraction | null;
  explanation: Explanation | null;
  confirmed: boolean;
  answers: Answers | null;
  letter: LetterState | null;
};

const EMPTY: Session = { source: null, extraction: null, explanation: null, confirmed: false, answers: null, letter: null };
const KEY = "overturn.session.v1";

type Ctx = {
  session: Session;
  hydrated: boolean;
  setResult: (source: Source, extraction: Extraction, explanation: Explanation) => void;
  setExtraction: (extraction: Extraction, confirmed: boolean) => void;
  setAnswers: (answers: Answers) => void;
  setLetter: (letter: LetterState | null) => void;
  reset: () => void;
};

const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Hydrating from sessionStorage is a genuine post-mount effect (no storage on the server).
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setSession({ ...EMPTY, ...(JSON.parse(raw) as Session) });
    } catch {
      /* storage unavailable: in-memory only */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* ignore */
    }
  }, [session, hydrated]);

  const setResult = useCallback<Ctx["setResult"]>((source, extraction, explanation) => {
    setSession({ ...EMPTY, source, extraction, explanation });
  }, []);
  const setExtraction = useCallback<Ctx["setExtraction"]>((extraction, confirmed) => {
    setSession((s) => ({ ...s, extraction, confirmed, letter: null }));
  }, []);
  const setAnswers = useCallback<Ctx["setAnswers"]>((answers) => {
    setSession((s) => ({ ...s, answers, letter: null }));
  }, []);
  const setLetter = useCallback<Ctx["setLetter"]>((letter) => {
    setSession((s) => ({ ...s, letter }));
  }, []);
  const reset = useCallback(() => setSession(EMPTY), []);

  const value = useMemo(() => ({ session, hydrated, setResult, setExtraction, setAnswers, setLetter, reset }), [session, hydrated, setResult, setExtraction, setAnswers, setLetter, reset]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside SessionProvider");
  return ctx;
}
