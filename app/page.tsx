import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CalendarClock, FileSearch, LifeBuoy, Lock, PenLine, Quote, Scale, ScrollText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevealObserver } from "@/components/reveal";

/**
 * The public home page: what Overturn is, why it exists, how it works, and one clear way
 * in. The flow itself lives at /start so this page can breathe.
 *
 * Direction: editorial, warm paper, one deep teal. Asymmetric hero, a hairline stats band,
 * the three steps as alternating rows with real screens. No three-identical-cards grids.
 */
export default function Home() {
  return (
    <div className="pb-8">
      <RevealObserver />
      {/* Hero */}
      <section className="relative -mt-8 pb-16 pt-14 before:absolute before:-top-24 before:bottom-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:content-[''] before:halo sm:pb-24 sm:pt-20">
        <div className="mx-auto grid max-w-[1040px] items-center gap-12 md:grid-cols-[1.2fr_0.9fr] md:gap-8">
          <div>
            <p className="eyebrow">
              <Lock className="size-3.5" aria-hidden="true" />
              Free · Nothing stored · Information, not legal advice
            </p>
            <h1 className="mt-6 font-serif text-[2.6rem] font-medium leading-[1.02] text-primary sm:text-6xl md:text-[4.4rem]">
              Your insurer said no.
              <br />
              <span className="text-foreground">
                Understand why. Know your deadline. <em>Answer back.</em>
              </span>
            </h1>
            <p className="mt-7 max-w-[54ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Upload a denial letter or an Explanation of Benefits. Overturn explains it in plain English, shows the rights and deadlines
              that apply to you with the law behind each one, and drafts an appeal letter you edit and send.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button className="group h-14 pl-7 pr-2 text-base" nativeButton={false} render={<Link href="/start?mode=upload" />}>
                Start with my document
                <span className="ml-3 flex size-10 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:scale-105">
                  <ArrowRight aria-hidden="true" className="size-5" />
                </span>
              </Button>
              <Button variant="ghost" className="h-14 px-6 text-base text-primary hover:bg-primary/8" nativeButton={false} render={<Link href="/start?mode=sample" />}>
                Try a sample first
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">About a minute. Works on a phone. No account. Samples need no upload at all.</p>
          </div>

          {/* Before / after: two sheets, the second laid over the first like paper on a desk. */}
          <div className="relative md:pl-4" aria-label="Example: a denial sentence and its plain-English reading">
            <div className="surface rounded-[1.6rem] p-5 font-serif text-[0.95rem] leading-relaxed text-muted-foreground md:-rotate-2 md:transition-transform md:duration-700 md:ease-[var(--ease-out-expo)] md:hover:rotate-0">
              <p className="font-sans text-[10px] font-medium uppercase tracking-[0.18em]">From the letter</p>
              <p className="mt-2">
                “The requested service is not medically necessary. Based on the clinical information submitted, our medical guideline
                MHP-MSK-014 requires documentation of at least six weeks of conservative treatment… Reason code: 50.”
              </p>
            </div>
            <div className="shell relative z-10 -mt-6 ml-3 rounded-[1.8rem] p-1.5 sm:ml-10 md:rotate-1 md:transition-transform md:duration-700 md:ease-[var(--ease-out-expo)] md:hover:rotate-0">
              <div className="surface-strong rounded-[calc(1.8rem-0.375rem)] bg-paper p-5">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">In plain English</p>
                <p className="mt-2 text-[1rem] leading-relaxed">
                  The plan denied the MRI because its guideline wants six weeks of physical therapy or similar treatment on record first.
                  The letter does not say the MRI was useless, only that this paperwork is missing.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 tnum">
                    <CalendarClock className="size-3.5 text-primary" aria-hidden="true" /> Appeal by Mar 7, 2027 · 170 days left
                  </span>
                  <span className="surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <ScrollText className="size-3.5 text-primary" aria-hidden="true" /> 29 CFR 2560.503-1
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats: a hairline band, not a card. */}
      <section aria-labelledby="why" data-reveal="" className="mx-auto max-w-[1040px] py-6 sm:py-10">
        <h2 id="why" className="sr-only">
          Why this matters
        </h2>
        <dl className="grid gap-8 border-y border-[var(--hairline)] py-10 sm:grid-cols-3 sm:gap-6">
          {[
            ["19 %", "of in-network claims on HealthCare.gov were denied in 2024"],
            ["< 1 %", "of those denials were appealed by the consumer"],
            ["34 %", "of the appeals that were filed succeeded"],
          ].map(([n, t], i) => (
            <div key={n} className={i > 0 ? "sm:border-l sm:border-[var(--hairline)] sm:pl-6" : ""}>
              <dt className="display font-serif text-5xl font-medium text-primary tnum sm:text-6xl">{n}</dt>
              <dd className="mt-2 max-w-[26ch] text-sm leading-snug text-muted-foreground">{t}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 max-w-[62ch] text-muted-foreground">
          People do not skip the appeal because they agree with the denial. They skip it because the letter is unreadable, the rights are
          unknown, and the deadline is invisible.{" "}
          <a
            href="https://www.kff.org/patient-consumer-protections/claims-denials-and-appeals-in-aca-marketplace-plans-in-2024/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
          >
            Source: KFF, 2024
          </a>
        </p>
      </section>

      {/* How it works: three rows, screen and text alternating sides. */}
      <section aria-labelledby="how" className="mx-auto max-w-[1040px] py-16 sm:py-24">
        <p className="eyebrow">How it works</p>
        <h2 id="how" className="mt-4 font-serif text-4xl font-medium text-primary sm:text-5xl">
          Upload once. Then <em>three</em> steps.
        </h2>
        <ol className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
          {[
            {
              n: "01",
              icon: FileSearch,
              t: "Understand",
              d: "Every fact, with the exact words it came from. A summary at an 8th-grade level. Your first deadline as a date and a countdown.",
              img: "/screens/understand.png",
              alt: "Understand screen for the MRI denial: the short version, the amount billed, and the appeal deadline",
            },
            {
              n: "02",
              icon: BookOpenCheck,
              t: "Know your rights",
              d: "Five questions. Then the protections that apply, most relevant first, each with its legal citation and a link to the source.",
              img: "/screens/rights.png",
              alt: "Rights screen for the MRI denial: the 180-day internal appeal deadline and the first rule that applies, with its source",
            },
            {
              n: "03",
              icon: PenLine,
              t: "Send your appeal",
              d: "A letter built only from your facts and those rights, with visible blanks for what only you know. Edit, download, send.",
              img: "/screens/letter.png",
              alt: "Letter screen for the MRI denial: the draft appeal with highlighted blanks to fill in",
            },
          ].map((s, i) => (
            <li key={s.n} data-reveal="" className="grid items-center gap-8 md:grid-cols-12 md:gap-10">
              <div className={i % 2 === 1 ? "md:order-2 md:col-span-6 md:col-start-7" : "md:col-span-6"}>
                <span className="display font-serif text-6xl font-light leading-none text-primary/60 tnum sm:text-7xl" aria-hidden="true">
                  {s.n}
                </span>
                <h3 className="mt-3 flex items-center gap-3 font-serif text-3xl font-medium text-foreground">
                  <s.icon className="size-7 text-primary" aria-hidden="true" />
                  {s.t}
                </h3>
                <p className="mt-3 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
              <div className={i % 2 === 1 ? "md:order-1 md:col-span-5" : "md:col-span-5 md:col-start-8"}>
                <div className="shell rounded-[2rem] p-2">
                  <div className="surface max-h-[420px] overflow-hidden rounded-[calc(2rem-0.5rem)] bg-muted/40">
                    <Image src={s.img} alt={s.alt} width={780} height={1400} sizes="(min-width: 768px) 380px, 90vw" className="h-auto w-full dark:hidden" />
                    <Image src={s.img.replace(".png", "-dark.png")} alt="" aria-hidden="true" width={780} height={1400} sizes="(min-width: 768px) 380px, 90vw" className="hidden h-auto w-full dark:block" />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What makes it different: a hairline list, not cards. */}
      <section aria-labelledby="diff" data-reveal="" className="mx-auto max-w-[1040px] py-16 sm:py-24">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div>
            <p className="eyebrow">Why it can be trusted</p>
            <h2 id="diff" className="mt-4 font-serif text-4xl font-medium text-primary sm:text-5xl">
              The model reads. The code decides. <em>You</em> send.
            </h2>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
              An AI is good at reading a messy letter. It is the wrong tool for deciding which law applies, because it cannot be audited.
              So Overturn splits the job.
            </p>
          </div>
          <ul className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {[
              { icon: Quote, t: "Every fact has a receipt", d: "Tap any fact to see the sentence and page it was read from. Nothing is summarized without a quote." },
              { icon: ScrollText, t: "Every right has a source", d: "Which rules apply is computed by code from a dataset where each rule carries its citation, its primary source, and the date a person last verified it." },
              { icon: CalendarClock, t: "Every deadline shows its math", d: "Start date, rule, result. If your letter states a shorter window than the law allows, Overturn says so." },
              { icon: LifeBuoy, t: "A person is one tap away", d: "Your state's free Consumer Assistance Program and regulator, on every screen. Overturn informs; they can advise." },
            ].map((f) => (
              <li key={f.t} className="group flex gap-5 py-6">
                <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-105">
                  <f.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-serif text-xl font-medium">{f.t}</p>
                  <p className="mt-1.5 max-w-[52ch] leading-relaxed text-muted-foreground">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Trust */}
      <section aria-labelledby="trust" data-reveal="" className="mx-auto max-w-[1040px] py-8 sm:py-12">
        <div className="shell rounded-[2rem] p-2">
          <div className="surface-muted rounded-[calc(2rem-0.5rem)] p-6 sm:p-10">
            <h2 id="trust" className="font-serif text-3xl font-medium text-primary sm:text-4xl">
              Built to stay on the right side of the line
            </h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {[
                { icon: Scale, t: "Information, not advice", d: "It explains what your document says and what rules generally apply. It never tells you what to do." },
                { icon: ShieldCheck, t: "Not a lawyer", d: "No prediction of whether your appeal will succeed, and no claim that the denial was wrong." },
                { icon: Lock, t: "Nothing stored", d: "Your document is read once, in memory, then discarded. Your session lives in your browser tab." },
              ].map((c) => (
                <div key={c.t}>
                  <c.icon className="size-6 text-primary" aria-hidden="true" />
                  <p className="mt-3 font-serif text-xl font-medium">{c.t}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
              Covers job-based, Marketplace, and individual plans, with state rules for California, New York, and Texas and the federal
              baseline everywhere else. Not Medicare, Medicaid, TRICARE, or VA.{" "}
              <Link href="/about" className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
                Read how it works and why
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section data-reveal="" className="mx-auto max-w-[1040px] py-12 sm:py-20">
        <div className="relative overflow-hidden rounded-[2rem] bg-primary p-8 text-primary-foreground shadow-[var(--shadow-lift)] sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-[26rem] rounded-full bg-primary-foreground/10 blur-3xl"
          />
          <div className="relative grid items-end gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-serif text-4xl font-medium sm:text-5xl">
                Have a denial <em>in hand?</em>
              </h2>
              <p className="mt-4 max-w-[46ch] text-lg text-primary-foreground/85">
                Read it with Overturn in about a minute, or try one of seven fictional samples first.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Button variant="secondary" className="group h-14 pl-7 pr-2 text-base" nativeButton={false} render={<Link href="/start?mode=upload" />}>
                Start now
                <span className="ml-3 flex size-10 items-center justify-center rounded-full bg-primary/10 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight aria-hidden="true" className="size-5" />
                </span>
              </Button>
              <Button
                variant="ghost"
                className="h-14 px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                nativeButton={false}
                render={<Link href="/learn" />}
              >
                How appeals work
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
