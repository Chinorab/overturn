import { ExternalLink, Info, ShieldCheck, FileSearch, Route, CalendarClock } from "lucide-react";
import type { AppliedRule } from "@/lib/rules/engine";
import { RuleLabel } from "@/components/ai-label";
import { fmtShort } from "@/components/deadline-clock";
import { cn } from "@/lib/utils";

const KIND = {
  deadline: { icon: CalendarClock, label: "Deadline" },
  protection: { icon: ShieldCheck, label: "Protection" },
  right: { icon: FileSearch, label: "Your right" },
  process: { icon: Route, label: "How it works" },
} as const;

const JURIS: Record<string, string> = { federal: "Federal", nsa: "No Surprises Act", CA: "California", NY: "New York", TX: "Texas" };

/**
 * One applicable rule: what it is, why it applies to this situation, any caveat, and
 * always the legal reference + primary source + verification date.
 */
export function RightsCard({ applied, highlight = false }: { applied: AppliedRule; highlight?: boolean }) {
  const { rule, why, caveat } = applied;
  const k = KIND[rule.category];
  const Icon = k.icon;
  return (
    <article className={cn("rounded-2xl border bg-card p-5", highlight && "border-primary/50 shadow-[0_0_0_3px_var(--secondary)]")}>
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3.5" aria-hidden="true" />
          {k.label}
        </span>
        <span aria-hidden="true">·</span>
        <span>{JURIS[rule.jurisdiction] ?? rule.jurisdiction}</span>
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug">{rule.title}</h3>
      <p className="mt-2 text-base">{rule.summary}</p>
      <p className="mt-3 rounded-lg bg-muted/70 p-3 text-sm">
        <span className="font-medium">Why this applies to you: </span>
        {why}
      </p>
      {caveat && (
        <p className="mt-2 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>{caveat}</span>
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <RuleLabel />
        <span>{rule.legal_ref}</span>
        <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-primary underline-offset-4 hover:underline">
          Source <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <span>Verified {fmtShort(rule.last_verified)}</span>
      </div>
    </article>
  );
}
