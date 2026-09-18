"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, Info, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/choice-group";
import { DeadlineClock } from "@/components/deadline-clock";
import { NativeSelect, TextInput } from "@/components/native-select";
import { RightsCard } from "@/components/rights-card";
import { computeRights } from "@/lib/rules/engine";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import { isSupportedState, US_STATES, type PlanSource, type USStateCode, type YesNoUnknown } from "@/lib/schemas/core";
import type { Extraction } from "@/lib/schemas/extraction";
import { useSession, type Answers } from "@/lib/session";
import { buildSituation } from "@/lib/situation";

/**
 * Step 3. Five short questions, then the rules engine runs in the browser and the page
 * updates as answers change. Nothing here comes from the model.
 */
export default function RightsPage() {
  const router = useRouter();
  const { session, hydrated } = useSession();
  const ex = session.extraction;
  useEffect(() => {
    if (hydrated && (!ex || !session.confirmed)) router.replace(ex ? "/understand" : "/");
  }, [hydrated, ex, session.confirmed, router]);
  if (!hydrated || !ex || !session.confirmed) return null;
  return <RightsView ex={ex} initial={session.answers} />;
}

function RightsView({ ex, initial }: { ex: Extraction; initial: Answers | null }) {
  const router = useRouter();
  const { setAnswers } = useSession();

  const [state, setState] = useState<USStateCode | "">(initial?.state ?? ex.state_hint.value ?? "");
  const [plan, setPlan] = useState<PlanSource | "">(initial?.plan_source ?? "");
  const [selfFunded, setSelfFunded] = useState<YesNoUnknown | "">(initial?.self_funded ?? "");
  const [emergency, setEmergency] = useState<YesNoUnknown | "">(initial?.emergency ?? (ex.emergency_signals.value ? "yes" : ""));
  const [urgent, setUrgent] = useState<"yes" | "no" | "">(initial?.urgent ?? (ex.urgency_signals.value ? "yes" : ""));
  const [finalDate, setFinalDate] = useState(initial?.final_internal_denial_date ?? "");

  const effectiveSelfFunded: YesNoUnknown | "" = plan === "employer" ? selfFunded : plan === "" ? "" : "no";
  const complete = state !== "" && plan !== "" && effectiveSelfFunded !== "" && emergency !== "" && urgent !== "";

  const answers: Answers | null = complete
    ? {
        state: state as USStateCode,
        plan_source: plan as PlanSource,
        self_funded: effectiveSelfFunded as YesNoUnknown,
        emergency: emergency as YesNoUnknown,
        urgent: urgent as "yes" | "no",
        final_internal_denial_date: /^\d{4}-\d{2}-\d{2}$/.test(finalDate) ? finalDate : undefined,
      }
    : null;

  const result = useMemo(() => {
    if (!answers) return null;
    const s = buildSituation(ex, answers);
    return s ? computeRights(s, ALL_RULES, HELP_RESOURCES) : null;
  }, [ex, answers?.state, answers?.plan_source, answers?.self_funded, answers?.emergency, answers?.urgent, answers?.final_internal_denial_date]); // eslint-disable-line react-hooks/exhaustive-deps

  function next() {
    if (!answers) return;
    setAnswers(answers);
    router.push("/letter");
  }

  const ruleById = (id: string) => ALL_RULES.find((r) => r.id === id)!;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-primary sm:text-4xl">Your rights and deadlines</h1>
        <p className="mt-2 text-muted-foreground">Five quick questions. The answers decide which rules apply; the list below updates as you go.</p>
      </header>

      <div className="space-y-4">
        <fieldset className="rounded-2xl border bg-card p-5">
          <legend className="px-1 text-base font-semibold">Which state do you live in?</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Read from the addresses in your document. State rules are included for California, New York, and Texas; everywhere else gets the
            federal rules that apply nationwide.
          </p>
          <NativeSelect aria-label="State" className="mt-3 sm:max-w-xs" value={state} onChange={(e) => setState(e.target.value as USStateCode)}>
            <option value="" disabled>
              Choose…
            </option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
                {isSupportedState(s) ? " (state rules included)" : ""}
              </option>
            ))}
          </NativeSelect>
        </fieldset>

        <ChoiceGroup<PlanSource>
          name="plan"
          legend="Where does your health plan come from?"
          value={plan}
          onChange={setPlan}
          options={[
            { value: "employer", label: "A job", hint: "Yours or a family member's employer" },
            { value: "marketplace", label: "The Marketplace", hint: "HealthCare.gov or a state exchange" },
            { value: "direct", label: "Bought directly", hint: "From an insurer or broker" },
            { value: "other", label: "Something else", hint: "Union, school, association…" },
          ]}
        />

        {plan === "employer" && (
          <ChoiceGroup<YesNoUnknown>
            name="selffunded"
            legend="Is the plan self-funded?"
            help={
              <>
                Many large employers pay claims themselves and hire an insurer only to run the plan. If so, state rules generally do not apply and
                the federal route is the one that counts. <strong>Not sure is a fine answer</strong>: both routes will be shown. To find out,
                ask HR, or look for the words &quot;self-funded&quot; or &quot;administered by&quot; in your plan booklet or on your card.
              </>
            }
            value={selfFunded}
            onChange={setSelfFunded}
            options={[
              { value: "unknown", label: "I don't know" },
              { value: "no", label: "No, it is insured", hint: "The insurer pays claims" },
              { value: "yes", label: "Yes, self-funded", hint: "The employer pays claims" },
            ]}
          />
        )}

        <ChoiceGroup<YesNoUnknown>
          name="emergency"
          legend="Was this emergency care?"
          help="An emergency room visit, an ambulance, or an emergency admission. Emergencies have special protections against surprise bills, whatever the network status."
          value={emergency}
          onChange={setEmergency}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unknown", label: "Not sure" },
          ]}
        />

        <ChoiceGroup<"yes" | "no">
          name="urgent"
          legend="Is the treatment ongoing or urgent?"
          help="For example you are in the hospital now, or waiting would seriously harm your health. Urgent cases get a 72-hour fast track."
          value={urgent}
          onChange={setUrgent}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />

        <fieldset className="rounded-2xl border bg-card p-5">
          <legend className="px-1 text-base font-semibold">Already appealed to the plan? (optional)</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            If the plan has already sent its final decision on your internal appeal, enter that date. It starts the clock for outside review.
          </p>
          <TextInput type="date" aria-label="Date of the plan's final internal appeal decision" className="mt-3 sm:max-w-xs" value={finalDate} onChange={(e) => setFinalDate(e.target.value)} />
        </fieldset>
      </div>

      {result ? (
        <div className="space-y-8" aria-live="polite">
          <section aria-labelledby="deadlines" className="space-y-4">
            <h2 id="deadlines" className="text-xl font-semibold">
              Your deadlines
            </h2>
            {result.deadlines.map((d) => (
              <DeadlineClock key={d.rule_id} deadline={d} rule={ruleById(d.rule_id)} />
            ))}
          </section>

          {result.unsupported_note && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/50 bg-warning/5 p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>{result.unsupported_note}</span>
            </p>
          )}

          <section aria-labelledby="protections" className="space-y-4">
            <h2 id="protections" className="text-xl font-semibold">
              What applies to your situation
            </h2>
            <p className="text-sm text-muted-foreground">
              {result.rules.length} rules, most relevant first. Each one links to the law or regulator page it comes from.
            </p>
            {result.rules
              .filter((r) => r.rule.category !== "deadline")
              .map((r, i) => (
                <RightsCard key={r.rule.id} applied={r} highlight={i < 2} />
              ))}
          </section>

          <section aria-labelledby="help" className="rounded-2xl border bg-card p-5">
            <h2 id="help" className="text-xl font-semibold">
              Free help from a person
            </h2>
            <ul className="mt-3 divide-y">
              {result.help.slice(0, 3).map((h) => (
                <li key={h.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-sm text-muted-foreground">{h.what_they_do}</p>
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">
                    {h.phone && (
                      <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary">
                        <Phone className="size-4" aria-hidden="true" />
                        {h.phone}
                      </a>
                    )}
                    <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary">
                      <ExternalLink className="size-4" aria-hidden="true" />
                      Site
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/understand" />}>
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
            <Button className="h-12 text-base" onClick={next}>
              Draft my appeal letter <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-dashed p-5 text-muted-foreground">Answer the questions above and your deadlines and rights will appear here.</p>
      )}
    </div>
  );
}
