import { BookOpenCheck, FileSearch, Lock, Scale, Send, ShieldCheck } from "lucide-react";
import { IntakePanel } from "@/components/intake-panel";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="pt-2">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Free · Nothing stored · Information, not legal advice
        </p>
        <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-[1.15] text-primary sm:text-5xl">
          Your insurer said no.
          <br />
          <span className="text-foreground">Here is what it means, and what you can do.</span>
        </h1>
        <p className="mt-4 max-w-prose text-lg text-muted-foreground">
          Overturn reads your denial letter or Explanation of Benefits, explains it in plain English, shows the deadlines and protections that
          apply, and drafts an appeal letter you edit and send.
        </p>
      </section>

      <section aria-labelledby="start" className="rounded-3xl border bg-muted/40 p-4 sm:p-6">
        <h2 id="start" className="mb-4 text-lg font-semibold">
          Start here
        </h2>
        <IntakePanel />
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-lg font-semibold">
          How it works
        </h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileSearch, t: "The model reads", d: "An AI reads your document and shows the exact words each fact came from." },
            { icon: BookOpenCheck, t: "The code decides", d: "Which rights and deadlines apply is computed by rules, each linked to the law it comes from. Never by the AI." },
            { icon: Send, t: "You send", d: "The letter is yours to edit. Free human help is one tap away at every step." },
          ].map((s, i) => (
            <li key={s.t} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <s.icon className="size-5 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-3 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="isnot" className="grid gap-3 sm:grid-cols-3">
        <h2 id="isnot" className="sr-only">
          What Overturn is and is not
        </h2>
        {[
          { icon: Scale, t: "Information, not advice", d: "It explains; it does not tell you what to do." },
          { icon: ShieldCheck, t: "Not a lawyer", d: "No prediction of whether an appeal will succeed." },
          { icon: Lock, t: "Nothing stored", d: "Your document is read once, then discarded." },
        ].map((c) => (
          <div key={c.t} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
            <c.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold">{c.t}</p>
              <p className="text-sm text-muted-foreground">{c.d}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="text-sm text-muted-foreground">
        Covers job-based, Marketplace, and individual plans, with state rules for California, New York, and Texas and the federal baseline
        everywhere else. Does not cover Medicare, Medicaid, TRICARE, or VA.
      </p>
    </div>
  );
}
