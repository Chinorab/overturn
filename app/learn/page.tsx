import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RuleLabel } from "@/components/ai-label";
import { fmtShort } from "@/lib/format";
import { ALL_RULES, HELP_RESOURCES } from "@/lib/rules/load";
import type { Rule } from "@/lib/rules/schema";

export const metadata: Metadata = {
  title: "How appeals work",
  description: "The path from a denial to an overturned decision under US federal law, with the state rules for California, New York, and Texas, and where to get free help.",
};

const byId = (id: string) => ALL_RULES.find((r) => r.id === id)!;

/** The four stages of a US health-plan appeal, each backed by rules from the dataset. */
const STAGES: Array<{ n: number; title: string; lead: string; rules: string[] }> = [
  {
    n: 1,
    title: "Read the notice",
    lead: "A denial has to say why, cite the plan provision, and explain how to appeal. Missing pieces are themselves a problem for the plan.",
    rules: ["fed.notice.required_content", "fed.claim_file.free_copies"],
  },
  {
    n: 2,
    title: "Internal appeal: ask the plan to look again",
    lead: "You write to the plan. A different, qualified reviewer must decide, within fixed time limits. Most reversals happen here.",
    rules: ["fed.internal_appeal.filing_window", "fed.internal_appeal.decision_windows", "fed.internal_appeal.independent_reviewer", "fed.expedited.urgent_care"],
  },
  {
    n: 3,
    title: "External review: an independent decision",
    lead: "If the plan says no again, an outside reviewer the plan does not control decides, and the plan must follow the result.",
    rules: ["fed.external_review.filing_window", "fed.external_review.decision_windows", "fed.deemed_exhaustion"],
  },
  {
    n: 4,
    title: "Surprise bills have their own protection",
    lead: "Emergency care and out-of-network doctors at in-network hospitals are covered by the No Surprises Act, whatever the plan first decided.",
    rules: ["nsa.emergency.no_balance_billing", "nsa.facility.oon_provider_at_in_network_facility", "nsa.facility.no_consent_for_ancillary"],
  },
];

const STATES: Array<{ code: "CA" | "NY" | "TX"; name: string; blurb: string }> = [
  { code: "CA", name: "California", blurb: "Two regulators (DMHC and CDI). Independent Medical Review is free and available within six months of the plan's grievance decision." },
  { code: "NY", name: "New York", blurb: "External appeal through the Department of Financial Services within four months; a plan that misses its own appeal deadline is treated as having reversed the denial." },
  { code: "TX", name: "Texas", blurb: "Independent Review Organizations certified by the Texas Department of Insurance, paid for by the plan, with a 20-day decision (3 days if life-threatening)." },
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "What is an Explanation of Benefits (EOB)?", a: "A statement from your plan showing what a provider charged, what the plan allowed and paid, and what you may owe. It is not a bill, but it is often the first place a denial shows up, as a remark code next to a line item." },
  { q: "How long do I have to appeal?", a: "Under federal rules, at least 180 days from the day you receive the denial to file an internal appeal, and four months after the plan's final internal decision to request external review. Plans can give more time, never less. State rules can add options on top." },
  { q: "What is a self-funded plan, and why does it matter?", a: "Many large employers pay claims from their own money and hire an insurer only to administer the plan. Those plans follow federal rules only; state external-review laws generally do not reach them. Your Summary Plan Description or HR can tell you. If you are not sure, Overturn shows both routes." },
  { q: "Did I already miss my deadline?", a: "Count from the day you received the notice, not the day it was written. If the window has closed, plans sometimes accept late appeals for good cause, and a complaint to the regulator remains possible. The free help services listed below can tell you what is still open." },
  { q: "Do I need a lawyer?", a: "Most internal appeals and external reviews are filed by patients themselves or with a free consumer assistance program. Overturn provides information to help you do that; it does not give legal advice and cannot tell you what to do in your specific case. If you want advice, a lawyer or your state's consumer assistance program is the place to get it." },
  { q: "Does Overturn cover Medicare or Medicaid?", a: "No. Those programs have their own multi-level appeal systems with different deadlines. Overturn recognizes those documents and stops with a link to the official process rather than applying the wrong rules." },
  { q: "What happens to my document?", a: "It is read once, in memory, during a single request, and discarded. Nothing is stored on a server; your session lives in your browser tab. The sample documents are fictional." },
];

function RuleRow({ rule }: { rule: Rule }) {
  return (
    <li className="rounded-xl border bg-card p-4">
      <p className="font-semibold leading-snug">{rule.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{rule.summary}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{rule.legal_ref}</span>
        <a href={rule.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
          Source <ExternalLink className="size-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <span>Verified {fmtShort(rule.last_verified)}</span>
      </p>
    </li>
  );
}

export default function LearnPage() {
  return (
    <div className="space-y-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Know your rights</p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-[1.15] text-primary sm:text-5xl">How appealing a health insurance denial works</h1>
        <p className="mt-4 max-w-prose text-lg text-muted-foreground">
          Every job-based, Marketplace, and individual plan in the United States has to follow the same federal appeal rules. Some states add
          more. This page is the map; Overturn applies it to your document.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <RuleLabel />
          <span className="text-xs text-muted-foreground">Everything below comes from the same rules dataset the app uses.</span>
        </div>
      </header>

      <section aria-labelledby="path">
        <h2 id="path" className="text-xl font-semibold">
          The path, in four stages
        </h2>
        <ol className="mt-4 space-y-8">
          {STAGES.map((s) => (
            <li key={s.n} className="relative pl-12">
              <span className="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground" aria-hidden="true">
                {s.n}
              </span>
              <h3 className="text-lg font-semibold">
                <span className="sr-only">Stage {s.n}: </span>
                {s.title}
              </h3>
              <p className="mt-1 text-muted-foreground">{s.lead}</p>
              <ul className="mt-3 space-y-2">
                {s.rules.map((id) => (
                  <RuleRow key={id} rule={byId(id)} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="states">
        <h2 id="states" className="text-xl font-semibold">
          What your state adds
        </h2>
        <p className="mt-1 text-muted-foreground">
          State rules apply to plans regulated by the state (insured job-based plans, Marketplace and individual plans). Overturn currently
          includes three states; everywhere else, the federal rules above still apply.
        </p>
        <div className="mt-4 grid gap-4">
          {STATES.map((st) => {
            const rules = ALL_RULES.filter((r) => r.jurisdiction === st.code);
            const help = HELP_RESOURCES.filter((h) => h.scope === st.code);
            return (
              <article key={st.code} className="rounded-2xl border bg-card p-5">
                <h3 className="text-lg font-semibold">{st.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{st.blurb}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary">
                    {rules.length} state {rules.length === 1 ? "rule" : "rules"} and {help.length} {help.length === 1 ? "place" : "places"} to get free help
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {rules.map((r) => (
                      <RuleRow key={r.id} rule={r} />
                    ))}
                  </ul>
                  <ul className="mt-3 divide-y rounded-xl border">
                    {help.map((h) => (
                      <li key={h.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          <span className="font-medium">{h.name}</span>
                          <span className="block text-muted-foreground">{h.what_they_do}</span>
                        </span>
                        <span className="flex shrink-0 gap-3">
                          {h.phone && (
                            <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1 font-medium text-primary">
                              <Phone className="size-4" aria-hidden="true" />
                              {h.phone}
                            </a>
                          )}
                          <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-4 decoration-primary/40">
                            Site <ExternalLink className="size-4" aria-hidden="true" />
                          </a>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Not in one of these states? Every state has an insurance department and most have a free Consumer Assistance Program:{" "}
          <a href="https://www.cms.gov/cciio/resources/consumer-assistance-grants" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
            find yours on CMS.gov
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className="text-xl font-semibold">
          Common questions
        </h2>
        <div className="mt-4 divide-y rounded-2xl border bg-card">
          {FAQ.map((f) => (
            <details key={f.q} className="group p-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium">
                {f.q}
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border bg-muted/40 p-6 text-center">
        <h2 className="text-xl font-semibold">Have a denial in hand?</h2>
        <p className="mt-1 text-muted-foreground">Overturn applies all of this to your document in about a minute.</p>
        <Button className="mt-4 h-12 text-base" nativeButton={false} render={<Link href="/start" />}>
          Start with my document <ArrowRight aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}
