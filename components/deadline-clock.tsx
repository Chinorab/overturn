import { AlertTriangle, CalendarClock, Clock, ExternalLink, Hourglass, Info } from "lucide-react";
import type { ComputedDeadline } from "@/lib/rules/engine";
import type { Rule } from "@/lib/rules/schema";
import { cn } from "@/lib/utils";
import { RuleLabel } from "@/components/ai-label";
import { fmtLong, fmtShort } from "@/lib/format";
export { fmtLong, fmtShort };

const TONE = {
  ok: { ring: "border-border", badge: "bg-muted text-foreground", icon: Clock, word: "On track" },
  soon: { ring: "border-warning/60", badge: "bg-warning/15 text-warning", icon: AlertTriangle, word: "Coming up" },
  urgent: { ring: "border-destructive/60", badge: "bg-destructive/10 text-destructive", icon: AlertTriangle, word: "Very soon" },
  passed: { ring: "border-destructive/60", badge: "bg-destructive/10 text-destructive", icon: Info, word: "Passed" },
  pending: { ring: "border-dashed", badge: "bg-muted text-muted-foreground", icon: Hourglass, word: "Not started" },
} as const;

/**
 * The signature component. A date, a count of days, and — always — the formula that
 * produced it and the primary source. Never color-only: icon + word carry the status.
 */
export function DeadlineClock({ deadline, rule, compact = false }: { deadline: ComputedDeadline; rule: Rule; compact?: boolean }) {
  const t = TONE[deadline.status];
  const Icon = t.icon;
  const days = deadline.days_left;

  return (
    <section aria-labelledby={`dl-${deadline.rule_id}`} className={cn("rounded-2xl border-2 bg-card p-5", t.ring)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`dl-${deadline.rule_id}`} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden="true" />
          {deadline.label}
        </h3>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", t.badge)}>
          <Icon className="size-3.5" aria-hidden="true" />
          {t.word}
        </span>
      </div>

      {deadline.due ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="font-serif text-3xl font-semibold leading-none tracking-tight">{fmtLong(deadline.due)}</p>
          <p className="text-lg text-muted-foreground">
            {days !== null && days >= 0 ? (
              <>
                <span className="font-semibold text-foreground">{days}</span> {days === 1 ? "day" : "days"} left
              </>
            ) : days !== null ? (
              <>
                <span className="font-semibold text-foreground">{Math.abs(days)}</span> {Math.abs(days) === 1 ? "day" : "days"} ago
              </>
            ) : null}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-base">{deadline.pending_reason}</p>
      )}

      {deadline.discrepancy === "letter_shorter" && deadline.letter_stated && (
        <p className="mt-3 rounded-lg bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mr-1 inline size-4 text-warning" aria-hidden="true" />
          Your document mentions a shorter window (until {fmtShort(deadline.letter_stated)}). Federal rules set a minimum of 180 days, which a plan cannot
          shorten. The date above is the legal minimum; if in doubt, sending earlier is always allowed.
        </p>
      )}
      {deadline.discrepancy === "letter_longer" && (
        <p className="mt-3 rounded-lg bg-muted p-3 text-sm">
          <Info className="mr-1 inline size-4" aria-hidden="true" />
          Your document gives more time than the legal minimum, so the date above uses the document&apos;s deadline.
        </p>
      )}
      {deadline.status === "passed" && (
        <p className="mt-3 rounded-lg bg-destructive/5 p-3 text-sm">
          This window appears to have closed. Plans sometimes accept late appeals when there is a good reason, and a complaint to the regulator
          remains possible. The free help services can tell you what is still open.
        </p>
      )}

      {!compact && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">How this date was calculated</summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            <p>
              {deadline.anchor ? (
                <>
                  Start: the {deadline.anchor_label} ({fmtShort(deadline.anchor)}). Add {rule.deadline?.amount} {rule.deadline?.unit}. {" "}
                </>
              ) : (
                <>Start: the {deadline.anchor_label}, which is not known yet. </>
              )}
              Rule: {rule.legal_ref}.
            </p>
            <p>{rule.summary}</p>
            <p className="flex flex-wrap items-center gap-2">
              <RuleLabel />
              <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                Read the source <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <span>Verified {fmtShort(rule.last_verified)}</span>
            </p>
          </div>
        </details>
      )}
    </section>
  );
}
