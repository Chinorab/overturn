import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarClock, FileSearch, LifeBuoy, Lock, PenLine, Quote, Scale, ScrollText, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The public home page: what Overturn is, why it exists, how it works, and one clear way
 * in. The flow itself lives at /start so this page can breathe.
 */
export default function Home() {
  return (
    <div className="space-y-20 pb-8">
      {/* Hero */}
      <section className="grid items-center gap-8 pt-4 md:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            Free · Nothing stored · Information, not legal advice
          </p>
          <h1 className="mt-4 font-serif text-[2.2rem] font-semibold leading-[1.1] text-primary sm:text-5xl md:text-[3.4rem]">
            Your insurer said no.
            <br />
            <span className="text-foreground">Understand why. Know your deadline. Answer back.</span>
          </h1>
          <p className="mt-5 max-w-prose text-lg text-muted-foreground">
            Upload a denial letter or an Explanation of Benefits. Overturn explains it in plain English, shows the rights and deadlines that
            apply to you with the law behind each one, and drafts an appeal letter you edit and send.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button className="h-13 px-6 text-base" nativeButton={false} render={<Link href="/start" />}>
              Start with my document <ArrowRight aria-hidden="true" />
            </Button>
            <Button variant="outline" className="h-13 px-6 text-base" nativeButton={false} render={<Link href="/start" />}>
              Try a sample first
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">About a minute. Works on a phone. No account.</p>
        </div>

        {/* Before / after */}
        <div className="relative" aria-label="Example: a denial sentence and its plain-English reading">
          <div className="rounded-2xl border bg-card p-4 font-serif text-sm leading-relaxed text-muted-foreground shadow-sm">
            <p className="font-sans text-[11px] font-medium uppercase tracking-wide">From the letter</p>
            <p className="mt-2">
              “The requested service is not medically necessary. Based on the clinical information submitted, our medical guideline
              MHP-MSK-014 requires documentation of at least six weeks of conservative treatment… Reason code: 50.”
            </p>
          </div>
          <div className="relative z-10 -mt-4 ml-4 rounded-2xl border-2 border-primary/40 bg-paper p-4 shadow-md sm:ml-8">
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary">In plain English</p>
            <p className="mt-2 text-[0.95rem] leading-relaxed">
              The plan denied the MRI because its guideline wants six weeks of physical therapy or similar treatment on record first. The
              letter does not say the MRI was useless, only that this paperwork is missing.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                <CalendarClock className="size-3.5 text-primary" aria-hidden="true" /> Appeal by Mar 7, 2027 · 170 days left
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1">
                <ScrollText className="size-3.5 text-primary" aria-hidden="true" /> 29 CFR 2560.503-1
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section aria-labelledby="why" className="rounded-3xl border bg-card p-6 sm:p-8">
        <h2 id="why" className="sr-only">
          Why this matters
        </h2>
        <dl className="grid gap-6 sm:grid-cols-3">
          {[
            ["19 %", "of in-network claims on HealthCare.gov were denied in 2024"],
            ["< 1 %", "of those denials were appealed by the consumer"],
            ["34 %", "of the appeals that were filed succeeded"],
          ].map(([n, t]) => (
            <div key={n}>
              <dt className="font-serif text-4xl font-semibold text-primary sm:text-5xl">{n}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{t}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-muted-foreground">
          People do not skip the appeal because they agree with the denial. They skip it because the letter is unreadable, the rights are
          unknown, and the deadline is invisible.{" "}
          <a href="https://www.kff.org/patient-consumer-protections/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4 decoration-primary/40">
            Source: KFF, 2024
          </a>
        </p>
      </section>

      {/* How it works, with real screens */}
      <section aria-labelledby="how">
        <h2 id="how" className="font-serif text-3xl font-semibold text-primary">
          Three steps, one document
        </h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            { n: 1, icon: FileSearch, t: "Understand", d: "Every fact, with the exact words it came from. A summary at an 8th-grade level. Your first deadline as a date and a countdown.", img: "/screens/understand.png", alt: "Understand screen showing a plain-English summary and a deadline" },
            { n: 2, icon: BookOpenCheck, t: "Know your rights", d: "Five questions. Then the protections that apply, most relevant first, each with its legal citation and a link to the source.", img: "/screens/rights.png", alt: "Rights screen showing the No Surprises Act protection with its source" },
            { n: 3, icon: PenLine, t: "Send your appeal", d: "A letter built only from your facts and those rights, with visible blanks for what only you know. Edit, download, send.", img: "/screens/letter.png", alt: "Letter screen listing the blanks to fill in" },
          ].map((s) => (
            <li key={s.n} className="flex flex-col rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{s.n}</span>
                <s.icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="text-lg font-semibold">{s.t}</h3>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              <div className="mt-4 max-h-[440px] overflow-hidden rounded-2xl border bg-muted/40">
                <Image src={s.img} alt={s.alt} width={780} height={1688} sizes="(min-width: 768px) 300px, 90vw" className="h-auto w-full" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What makes it different */}
      <section aria-labelledby="diff">
        <h2 id="diff" className="font-serif text-3xl font-semibold text-primary">
          The model reads. The code decides. You send.
        </h2>
        <p className="mt-2 max-w-prose text-muted-foreground">
          An AI is good at reading a messy letter. It is the wrong tool for deciding which law applies, because it cannot be audited. So
          Overturn splits the job.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { icon: Quote, t: "Every fact has a receipt", d: "Tap any fact to see the sentence and page it was read from. Nothing is summarized without a quote." },
            { icon: ScrollText, t: "Every right has a source", d: "Which rules apply is computed by code from a dataset where each rule carries its citation, its primary source, and the date a person last verified it." },
            { icon: CalendarClock, t: "Every deadline shows its math", d: "Start date, rule, result. If your letter states a shorter window than the law allows, Overturn says so." },
            { icon: LifeBuoy, t: "A person is one tap away", d: "Your state's free Consumer Assistance Program and regulator, on every screen. Overturn informs; they can advise." },
          ].map((f) => (
            <li key={f.t} className="flex gap-4 rounded-2xl border bg-card p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                <f.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">{f.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust" className="rounded-3xl border bg-muted/40 p-6 sm:p-8">
        <h2 id="trust" className="font-serif text-2xl font-semibold text-primary">
          Built to stay on the right side of the line
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Scale, t: "Information, not advice", d: "It explains what your document says and what rules generally apply. It never tells you what to do." },
            { icon: ShieldCheck, t: "Not a lawyer", d: "No prediction of whether your appeal will succeed, and no claim that the denial was wrong." },
            { icon: Lock, t: "Nothing stored", d: "Your document is read once, in memory, then discarded. Your session lives in your browser tab." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border bg-card p-4">
              <c.icon className="size-5 text-primary" aria-hidden="true" />
              <p className="mt-2 font-semibold">{c.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Covers job-based, Marketplace, and individual plans, with state rules for California, New York, and Texas and the federal baseline
          everywhere else. Not Medicare, Medicaid, TRICARE, or VA.{" "}
          <Link href="/about" className="text-primary underline underline-offset-4 decoration-primary/40">
            Read how it works and why
          </Link>
          .
        </p>
      </section>

      {/* Final CTA */}
      <section className="rounded-3xl bg-primary p-8 text-primary-foreground sm:p-10">
        <h2 className="font-serif text-3xl font-semibold">Have a denial in hand?</h2>
        <p className="mt-2 max-w-prose text-primary-foreground/85">Read it with Overturn in about a minute, or try one of seven fictional samples first.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" className="h-13 px-6 text-base" nativeButton={false} render={<Link href="/start" />}>
            Start now <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="ghost" className="h-13 px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" nativeButton={false} render={<Link href="/learn" />}>
            <Send className="rotate-[-20deg]" aria-hidden="true" /> How appeals work
          </Button>
        </div>
      </section>
    </div>
  );
}
