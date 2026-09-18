import { Lock, Scale, ShieldCheck } from "lucide-react";
import { IntakePanel } from "@/components/intake-panel";

export default function Home() {
  return (
    <>
      <section className="pb-2">
        <h1 className="font-serif text-[2rem] font-semibold leading-tight text-primary sm:text-5xl">
          Your insurer said no. Here is what that means, and what you can do.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload a denial letter or an Explanation of Benefits. Overturn reads it, explains it in plain English, shows the deadlines and
          protections that apply, and drafts an appeal letter that you edit and send yourself.
        </p>

        <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3" aria-label="What Overturn is and is not">
          <li className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <Scale className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong>Information, not advice.</strong> It explains; it does not tell you what to do.
            </span>
          </li>
          <li className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong>Not a lawyer.</strong> No prediction of whether an appeal will succeed.
            </span>
          </li>
          <li className="flex items-start gap-2 rounded-lg border bg-card p-3">
            <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <strong>Nothing stored.</strong> Your document is read once, then discarded.
            </span>
          </li>
        </ul>
      </section>

      <div className="mt-8">
        <IntakePanel />
      </div>

      <section aria-labelledby="how" className="mt-12 rounded-2xl border bg-card p-5">
        <h2 id="how" className="text-lg font-semibold">
          How it works, and how it stays on the right side of the line
        </h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">1. The model reads.</strong> An AI model pulls facts out of your document and shows you the exact words each one
            came from.
          </li>
          <li>
            <strong className="text-foreground">2. The code decides.</strong> Which rights and deadlines apply is computed by plain rules, each with a link to the
            law or regulator page it comes from. The AI never decides this.
          </li>
          <li>
            <strong className="text-foreground">3. You send.</strong> The draft letter is yours to edit. Overturn points you to free human help in your state at
            every step.
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">
          Covers job-based, Marketplace, and individual plans, with state-specific rules for California, New York, and Texas and the federal
          baseline everywhere else. Does not cover Medicare, Medicaid, TRICARE, or VA.
        </p>
      </section>
    </>
  );
}
