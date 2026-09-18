import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileSearch, Lock, Scale, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "About",
  description: "Why Overturn exists, how it stays on the right side of the line between legal information and legal advice, what it covers, and what happens to your document.",
};

export default function AboutPage() {
  return (
    <div className="space-y-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">About Overturn</p>
        <h1 className="mt-2 font-serif text-[2rem] font-semibold leading-[1.15] text-primary sm:text-5xl">Most denials are never appealed. Most appeals are worth filing.</h1>
        <p className="mt-4 max-w-prose text-lg text-muted-foreground">
          In 2024, insurers on HealthCare.gov denied 19 % of in-network claims. Fewer than 1 % of those denials were appealed, and a third of
          the appeals succeeded.{" "}
          <a href="https://www.kff.org/patient-consumer-protections/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
            KFF, 2024
          </a>
          . People do not skip the appeal because they agree with the denial. They skip it because the letter is unreadable, the rights are
          unknown, and the deadline is invisible.
        </p>
      </header>

      <section aria-labelledby="how">
        <h2 id="how" className="text-xl font-semibold">
          How it works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: FileSearch, t: "The model reads", d: "An AI model reads your document and returns facts, each with the exact words it came from and the page. It never infers what is not there." },
            { icon: BookOpenCheck, t: "The code decides", d: "Which rights and deadlines apply is computed by plain rules from a dataset where every rule carries its legal citation, its source, and the date a person last verified it. The AI has no say in this." },
            { icon: Send, t: "You send", d: "The letter is drafted from your facts and those rules only, with visible blanks for what only you know. You edit it, download it, and send it." },
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

      <section aria-labelledby="line" className="rounded-3xl border bg-card p-6">
        <h2 id="line" className="flex items-center gap-2 text-xl font-semibold">
          <Scale className="size-5 text-primary" aria-hidden="true" />
          Information, not advice
        </h2>
        <p className="mt-2 text-muted-foreground">
          In the United States, telling a specific person what to do about their legal problem is the practice of law, reserved to licensed
          attorneys. Explaining what a document says and what rules generally apply is legal information, which court self-help centers,
          consumer assistance programs, and regulators provide every day. Overturn is built to stay on the information side of that line.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-success/5 p-4 text-sm">
            <p className="font-semibold">What Overturn says</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>“This letter denies the claim as not medically necessary.”</li>
              <li>“Federal rules give at least 180 days to file an internal appeal.”</li>
              <li>“Here is a draft, for you to edit and send.”</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">What it never says</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>“Your denial was wrong.”</li>
              <li>“You should appeal by Friday.”</li>
              <li>“You will win.”</li>
            </ul>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This is enforced in the prompts, in the code that checks every generated sentence and every citation, and in the wording of every
          screen. The full argument is in{" "}
          <a href="https://github.com/Chinorab/overturn/blob/main/LEGAL_DESIGN.md" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
            LEGAL_DESIGN.md
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="privacy" className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h2 id="privacy" className="flex items-center gap-2 text-lg font-semibold">
            <Lock className="size-5 text-primary" aria-hidden="true" />
            Your document
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read once, in memory, during a single request, then discarded. No database, no upload storage, no analytics on content. Your
            session lives in your browser tab and disappears when you close it. The sample documents are fictional.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            What it covers
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Denial letters and Explanations of Benefits</li>
            <li>Job-based, Marketplace, and individual plans</li>
            <li>Federal rules everywhere; state rules for California, New York, and Texas</li>
            <li>Not Medicare, Medicaid, CHIP, TRICARE, or VA, which have their own appeal systems</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="who" className="text-sm text-muted-foreground">
        <h2 id="who" className="text-lg font-semibold text-foreground">
          Who made this
        </h2>
        <p className="mt-2">
          Overturn was built for LexHack 2026 by one person in nine days, with an AI coding assistant, and is open source under the MIT
          license. Every legal rule was read from a primary source and carries the date it was read. The code, the rules dataset, the tests,
          and a log of every API call are on{" "}
          <a href="https://github.com/Chinorab/overturn" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
            GitHub
          </a>
          .
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button className="h-12 text-base" nativeButton={false} render={<Link href="/start" />}>
          Start with my document <ArrowRight aria-hidden="true" />
        </Button>
        <Button variant="outline" className="h-12 text-base" nativeButton={false} render={<Link href="/learn" />}>
          How appeals work
        </Button>
      </div>
    </div>
  );
}
