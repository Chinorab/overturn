import Link from "next/link";
import { ArrowRight, BookOpen, Lock, Scale } from "lucide-react";
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

      <section aria-label="Learn more" className="grid gap-3 sm:grid-cols-2">
        <Link href="/learn" className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:border-primary">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold group-hover:text-primary">How appeals work in the US</p>
          <p className="mt-1 text-sm text-muted-foreground">The four stages, the deadlines, what your state adds, and where to get free help. Read it before or after.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Know your rights <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
        <Link href="/about" className="group rounded-2xl border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:border-primary">
          <Scale className="size-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold group-hover:text-primary">Why this is information, not advice</p>
          <p className="mt-1 text-sm text-muted-foreground">The model reads, the code decides, you send. How Overturn stays honest, what it covers, and what happens to your document.</p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            About Overturn <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </Link>
      </section>
    </div>
  );
}
