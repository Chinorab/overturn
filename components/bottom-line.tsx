import { CalendarClock } from "lucide-react";
import type { Extraction } from "@/lib/schemas/extraction";
import { DENIAL_CATEGORY_LABEL } from "@/lib/schemas/core";
import { fmtShort } from "@/lib/format";
import { RuleLabel } from "@/components/ai-label";

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

/**
 * The three things a stressed person wants first, stated from the extracted facts only
 * (no model prose): what was denied and why, what is at stake, and when the first deadline
 * falls. Every sentence degrades gracefully when a fact is absent.
 */
export function BottomLine({ ex, deadlineDue, daysLeft }: { ex: Extraction; deadlineDue: string | null; daysLeft: number | null }) {
  const cat = ex.denial_category.value;
  const service = ex.service_description.value;
  const owe = ex.amounts.patient_responsibility.value;
  const billed = ex.amounts.billed.value;
  const insurer = ex.insurer_name.value ?? "Your plan";

  const what = cat
    ? cat === "out_of_network"
      ? `${insurer} paid ${service ? `the ${shorten(service)}` : "this claim"} at the out-of-network rate.`
      : `${insurer} denied ${service ? `the ${shorten(service)}` : "this claim"}: ${DENIAL_CATEGORY_LABEL[cat].toLowerCase()}.`
    : `${insurer} sent a decision about ${service ? `the ${shorten(service)}` : "this claim"}.`;

  const stake =
    owe !== null ? `The document says you may owe ${money(owe)}.` : billed !== null ? `${money(billed)} was billed; the document does not say what you may owe.` : "The document does not state an amount.";

  return (
    <section aria-labelledby="bottom-line" className="surface-strong rounded-2xl p-5">
      <h2 id="bottom-line" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        The short version
      </h2>
      <ol className="mt-3 space-y-2 text-lg leading-snug">
        <li>{what}</li>
        <li>{stake}</li>
        <li className="flex items-start gap-2">
          <CalendarClock className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {deadlineDue && daysLeft !== null ? (
              daysLeft >= 0 ? (
                <>
                  You can appeal until <strong>{fmtShort(deadlineDue)}</strong>: {daysLeft} days, about {approxMonths(daysLeft)}.
                </>
              ) : (
                <>The standard appeal window closed on {fmtShort(deadlineDue)}; some options may remain (see below).</>
              )
            ) : (
              <>Your appeal deadline needs the date on the document; confirm it below.</>
            )}
          </span>
        </li>
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <RuleLabel />
        <span>Built from the facts below, not written by the AI.</span>
      </div>
    </section>
  );
}

function shorten(s: string): string {
  // Drop parenthetical billing codes for the headline; they stay in the facts list.
  const clean = s.replace(/\s*\([^)]*\)/g, "").replace(/;\s*/g, " and ").trim();
  const lower = clean.charAt(0).toLowerCase() + clean.slice(1);
  return lower.length > 70 ? lower.slice(0, 67).trimEnd() + "…" : lower;
}

function approxMonths(days: number): string {
  if (days < 21) return `${Math.max(1, Math.round(days / 7))} ${Math.round(days / 7) === 1 ? "week" : "weeks"}`;
  const m = days / 30.4;
  const rounded = Math.round(m * 2) / 2;
  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1).replace(".5", "½")} months`;
}
