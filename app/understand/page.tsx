"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiLabel } from "@/components/ai-label";
import { DeadlineClock } from "@/components/deadline-clock";
import { FactCard } from "@/components/fact-card";
import { GlossaryText } from "@/components/glossary-text";
import { NativeSelect, TextInput } from "@/components/native-select";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { DENIAL_CATEGORY_LABEL, DenialCategory, US_STATES, type USStateCode } from "@/lib/schemas/core";
import { CONFIDENCE_AUTO_ACCEPT, type Explanation, type Extraction, type Field } from "@/lib/schemas/extraction";
import { useSession } from "@/lib/session";
import { provisionalSituation } from "@/lib/situation";
import { fmtShort } from "@/components/deadline-clock";

const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : String(v));
const dateList = (v: unknown) => (Array.isArray(v) ? v.map((d) => fmtShort(String(d))).join(", ") : String(v));
const yesNo = (v: unknown) => (v ? "Yes" : "No");
const network = (v: unknown) => (v === "in_network" ? "In network" : v === "out_of_network" ? "Out of network" : "Not stated");
const docType = (v: unknown) => (v === "eob" ? "Explanation of Benefits" : v === "denial_letter" ? "Denial letter" : "Other");
const deadline = (v: unknown) => {
  const d = v as { kind: "date"; date: string } | { kind: "days"; days: number };
  return d.kind === "date" ? `By ${fmtShort(d.date)}` : `${d.days} days from the letter`;
};

/**
 * Step 2. What the document says, fact by fact, with sources; the first deadline; and a
 * short confirmation of the few fields the rules engine needs before it runs.
 */
export default function UnderstandPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const ex = session.extraction;
  const xp = session.explanation;

  useEffect(() => {
    if (hydrated && !ex) router.replace("/start");
  }, [hydrated, ex, router]);

  if (!hydrated || !ex || !xp) return null;
  return <UnderstandView ex={ex} xp={xp} />;
}

function UnderstandView({ ex, xp }: { ex: Extraction; xp: Explanation }) {
  const router = useRouter();
  const { session, setExtraction } = useSession();

  const [letterDate, setLetterDate] = useState(ex.letter_date.value ?? "");
  const [category, setCategory] = useState<string>(ex.denial_category.value ?? "");
  const [state, setState] = useState<string>(ex.state_hint.value ?? "");
  const [docKind, setDocKind] = useState<string>(ex.document_type.value ?? "");
  const [showAll, setShowAll] = useState(false);

  const preview = useMemo(() => {
    const s = provisionalSituation({ ...ex, letter_date: { ...ex.letter_date, value: letterDate || null } });
    if (!s) return null;
    const r = computeRights(s, ALL_RULES, HELP_RESOURCES);
    const d = r.deadlines.find((x) => x.rule_id === "fed.internal_appeal.filing_window");
    const rule = ALL_RULES.find((x) => x.id === "fed.internal_appeal.filing_window");
    return d && rule ? { d, rule } : null;
  }, [ex, letterDate]);

  const needs = (f: Field<unknown>) => f.value === null || f.confidence < CONFIDENCE_AUTO_ACCEPT;
  const attention = [needs(ex.letter_date), needs(ex.denial_category), needs(ex.state_hint), needs(ex.document_type)].filter(Boolean).length;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(letterDate) && DenialCategory.safeParse(category).success && (US_STATES as readonly string[]).includes(state) && (docKind === "eob" || docKind === "denial_letter");

  function confirm() {
    const stamp = <T,>(f: Field<T>, value: T): Field<T> =>
      f.value === value ? f : { value, confidence: 1, quote: "Confirmed by you", page: null };
    const next: Extraction = {
      ...ex,
      letter_date: stamp(ex.letter_date, letterDate),
      denial_category: stamp(ex.denial_category, category as DenialCategory),
      state_hint: stamp(ex.state_hint, state as USStateCode),
      document_type: stamp(ex.document_type, docKind as "eob" | "denial_letter"),
    };
    setExtraction(next, true);
    router.push("/rights");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="size-4" aria-hidden="true" />
          {session.source?.kind === "sample" ? `Sample: ${session.source.title}` : session.source?.name}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight text-primary sm:text-4xl">Here is what your document says</h1>
      </header>

      <section aria-labelledby="summary" className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="summary" className="text-lg font-semibold">
            In plain English
          </h2>
          <AiLabel />
        </div>
        <div className="mt-3">
          <GlossaryText text={xp.summary} terms={xp.terms} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Underlined words have a short definition. Tap one to read it.</p>
      </section>

      {preview ? (
        <DeadlineClock deadline={preview.d} rule={preview.rule} />
      ) : (
        <section className="rounded-2xl border-2 border-dashed p-5">
          <h2 className="font-semibold">Your first deadline</h2>
          <p className="mt-1 text-sm text-muted-foreground">Overturn needs the date on the document to count the days. Add it in the details below and the clock will appear.</p>
        </section>
      )}

      <section aria-labelledby="facts">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="facts" className="text-lg font-semibold">
            The facts, and where each one comes from
          </h2>
          <AiLabel what="Read by AI, quoted from your document" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FactCard label="Reason for the denial" field={ex.denial_category} format={(v) => DENIAL_CATEGORY_LABEL[v as DenialCategory]} required />
          <FactCard label="Date on the document" field={ex.letter_date} format={(v) => fmtShort(String(v))} required />
          <FactCard label="Insurer" field={ex.insurer_name} />
          <FactCard label="Service" field={ex.service_description} />
          <FactCard label="Amount billed" field={ex.amounts.billed} format={money} />
          <FactCard label="Amount you may owe (as stated)" field={ex.amounts.patient_responsibility} format={money} />
        </div>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary"
        >
          {showAll ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
          {showAll ? "Hide the other details" : "Show all 12 other details"}
        </button>
        {showAll && (
          <div className="mt-3 grid gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200 sm:grid-cols-2">
            <FactCard label="Document" field={ex.document_type} format={docType} />
            <FactCard label="Claim or reference number" field={ex.claim_number} />
            <FactCard label="Member ID" field={ex.member_id} />
            <FactCard label="Provider" field={ex.provider_name} />
            <FactCard label="Date(s) of service" field={ex.service_dates} format={dateList} />
            <FactCard label="Denial or remark codes" field={ex.denial_codes} format={(v) => (v as string[]).join(", ")} />
            <FactCard label="Amount the plan paid" field={ex.amounts.plan_paid} format={money} />
            <FactCard label="Network status" field={ex.network_status} format={network} />
            <FactCard label="Emergency care mentioned" field={ex.emergency_signals} format={yesNo} />
            <FactCard label="Appeal deadline stated in the document" field={ex.stated_appeal_deadline} format={deadline} />
            <FactCard label="Where the document says to send an appeal" field={ex.stated_appeal_address} />
            <FactCard label="State (from the addresses)" field={ex.state_hint} required />
          </div>
        )}
        <div className="mt-3 rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">What the document says about appealing</p>
          <p className="mt-1 text-muted-foreground">{ex.stated_appeal_instructions.value ?? "The document does not describe how to appeal. That is itself worth noting: federal rules require it."}</p>
        </div>
      </section>

      <section aria-labelledby="confirm" className="rounded-2xl border-2 border-primary/30 bg-card p-5">
        <h2 id="confirm" className="text-lg font-semibold">
          Check these four details
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {attention > 0
            ? `Overturn is unsure about ${attention} of them. The next step computes your deadlines and rights from these, so a wrong date here means a wrong deadline there.`
            : "They looked clear in the document. A quick glance is enough; the next step depends on them."}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Date on the document
            <TextInput type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className="mt-1" required />
          </label>
          <label className="block text-sm font-medium">
            Kind of document
            <NativeSelect value={docKind} onChange={(e) => setDocKind(e.target.value)} className="mt-1" required>
              <option value="" disabled>
                Choose…
              </option>
              <option value="denial_letter">Denial letter</option>
              <option value="eob">Explanation of Benefits</option>
            </NativeSelect>
          </label>
          <label className="block text-sm font-medium">
            Reason for the denial
            <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" required>
              <option value="" disabled>
                Choose…
              </option>
              {DenialCategory.options.map((c) => (
                <option key={c} value={c}>
                  {DENIAL_CATEGORY_LABEL[c]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="block text-sm font-medium">
            State you live in
            <NativeSelect value={state} onChange={(e) => setState(e.target.value)} className="mt-1" required>
              <option value="" disabled>
                Choose…
              </option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/start" />}>
            <ArrowLeft aria-hidden="true" /> Start over
          </Button>
          <Button className="h-12 text-base" disabled={!valid} onClick={confirm}>
            Continue: my rights and deadlines <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    </div>
  );
}
