import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, CalendarClock, FileSearch, LifeBuoy, Lock, PenLine, Quote, Scale, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RevealObserver } from "@/components/reveal";
import understandLight from "@/public/screens/understand.png";
import understandDark from "@/public/screens/understand-dark.png";
import rightsLight from "@/public/screens/rights.png";
import rightsDark from "@/public/screens/rights-dark.png";
import letterLight from "@/public/screens/letter.png";
import letterDark from "@/public/screens/letter-dark.png";

/**
 * The public home page: what Overturn is, why it exists, how it works, and one clear way
 * in. The flow itself lives at /start so this page can breathe.
 *
 * Direction: editorial, warm paper, one deep teal. Asymmetric hero, a hairline stats band,
 * the three steps as alternating rows with real screens, one trust section. No kickers,
 * no three-identical-cards grids, nothing said twice.
 */
const STEPS = [
  {
    n: "01",
    icon: FileSearch,
    t: "Understand",
    d: "Every fact, with the exact words it came from. A summary at an 8th-grade level. Your first deadline as a date and a countdown.",
    img: understandLight,
    imgDark: understandDark,
    alt: "Understand screen for the MRI denial: the short version, the amount billed, and the appeal deadline",
  },
  {
    n: "02",
    icon: BookOpenCheck,
    t: "Know your rights",
    d: "Five questions. Then the protections that apply, most relevant first, each with its legal citation and a link to the source.",
    img: rightsLight,
    imgDark: rightsDark,
    alt: "Rights screen for the MRI denial: the 180-day internal appeal deadline and the first rule that applies, with its source",
  },
  {
    n: "03",
    icon: PenLine,
    t: "Draft your appeal",
    d: "A letter built only from your facts and those rights, with visible blanks for what only you know. Edit, download, send.",
    img: letterLight,
    imgDark: letterDark,
    alt: "Letter screen for the MRI denial: the draft appeal with highlighted blanks to fill in",
  },
];

const PROOFS = [
  { icon: Quote, t: "Every fact has a receipt", d: "Tap any fact to see the sentence and page it was read from. Nothing is summarized without a quote." },
  { icon: ScrollText, t: "Every right has a source", d: "Which rules apply is computed by code from a dataset where each rule carries its citation, its primary source, and the date a person last verified it." },
  { icon: CalendarClock, t: "Every deadline shows its math", d: "Start date, rule, result. If your letter states a shorter window than the law allows, Overturn says so." },
  { icon: LifeBuoy, t: "A person is one tap away", d: "Your state's free Consumer Assistance Program and regulator, on every screen. Overturn informs; they can advise." },
];


export default function Home() {
  return (
    <div className="pb-8">
      <RevealObserver />

      {/* Hero. On a phone the example follows the buttons; on desktop it sits beside the copy. */}
      <section className="relative -mt-8 pb-16 pt-12 before:absolute before:-top-24 before:bottom-0 before:left-1/2 before:-z-10 before:w-screen before:-translate-x-1/2 before:content-[''] before:halo sm:pb-24 sm:pt-20">
        <div className="mx-auto grid max-w-[1040px] gap-8 md:grid-cols-[1.2fr_0.9fr] md:grid-rows-[auto_auto] md:items-center md:gap-x-8 md:gap-y-4">
          <div className="md:col-start-1 md:row-start-1">
            <h1 className="font-serif text-[2.6rem] font-medium leading-[1.02] text-primary sm:text-6xl md:text-[4.4rem]">
              Your insurer said no.
              <br />
              <span className="text-foreground">
                Understand why. Know your deadline. <em>Answer back.</em>
              </span>
            </h1>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Upload a denial letter or an Explanation of Benefits. Overturn explains it in plain English, shows your rights and deadlines
              with the law behind each one, and drafts the appeal letter you send.
            </p>
            <p className="mt-4 max-w-[54ch] text-base text-muted-foreground">
              For job-based, Marketplace, and individual plans. Not Medicare, Medicaid, TRICARE, or VA.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button className="group h-14 pl-7 pr-2 text-base" nativeButton={false} render={<Link href="/start?mode=upload" />}>
                Start with my document
                <span className="ml-3 flex size-10 items-center justify-center rounded-full bg-primary-foreground/15 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:scale-105">
                  <ArrowRight aria-hidden="true" className="size-5" />
                </span>
              </Button>
              <Button variant="ghost" className="h-14 px-6 text-base text-primary hover:bg-secondary hover:text-primary" nativeButton={false} render={<Link href="/start?mode=sample" />}>
                Try a sample first
              </Button>
            </div>
          </div>

          {/* Before / after: two sheets, the second laid over the first like paper on a desk. */}
          <figure className="relative md:col-start-2 md:row-span-2 md:row-start-1 md:pl-4">
            <figcaption className="sr-only">Example: a sentence from a denial letter and its plain-English reading</figcaption>
            <div className="surface rounded-[1.6rem] p-5 font-serif text-[0.95rem] leading-relaxed text-muted-foreground md:-rotate-2">
              <p className="font-sans text-xs font-medium uppercase tracking-[0.14em]">From the letter</p>
              <p className="mt-2">
                “The requested service is not medically necessary. Based on the clinical information submitted, our medical guideline
                MHP-MSK-014 requires documentation of at least six weeks of conservative treatment… Reason code: 50.”
              </p>
            </div>
            <div className="shell relative z-10 -mt-6 ml-3 rounded-[1.8rem] p-1.5 sm:ml-10 md:rotate-1">
              <div className="surface-strong rounded-[calc(1.8rem-0.375rem)] bg-paper p-5">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">In plain English</p>
                <p className="mt-2 text-[1rem] leading-relaxed">
                  The plan denied the MRI because its guideline wants six weeks of physical therapy or similar treatment on record first.
                  The letter does not say the MRI was useless, only that this paperwork is missing.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 tnum">
                    <CalendarClock className="size-3.5 text-primary" aria-hidden="true" /> Appeal by Mar 7, 2027 · 169 days left
                  </span>
                  <span className="surface inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <ScrollText className="size-3.5 text-primary" aria-hidden="true" /> Federal rule: 180 days to appeal
                    <span className="text-muted-foreground">· 29 CFR 2560.503-1</span>
                  </span>
                </div>
              </div>
            </div>
          </figure>

          <div className="text-sm text-muted-foreground md:col-start-1 md:row-start-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Lock className="size-4 text-primary" aria-hidden="true" />
              <span>Free · Nothing stored · No account</span>
            </p>
            <p className="mt-1.5">About a minute. A phone photo of the letter is fine.</p>
          </div>
        </div>
      </section>

      {/* Stats: a hairline band, not a card. Compact on phones. */}
      <section aria-labelledby="why" data-reveal="" className="mx-auto max-w-[1040px] py-6 sm:py-10">
        <h2 id="why" className="sr-only">
          Why this matters
        </h2>
        <dl className="grid gap-5 border-y border-[var(--hairline)] py-8 sm:grid-cols-3 sm:gap-6 sm:py-10">
          {[
            ["19%", "of in-network claims on HealthCare.gov were denied in 2024"],
            ["< 1%", "of those denials were appealed by the consumer"],
            ["34%", "of the appeals that were filed succeeded"],
          ].map(([n, t], i) => (
            <div key={n} className={"flex items-baseline gap-4 sm:block " + (i > 0 ? "sm:border-l sm:border-[var(--hairline)] sm:pl-6" : "")}>
              <dt className="display w-[4.5ch] shrink-0 font-serif text-4xl font-medium text-primary tnum sm:w-auto sm:text-6xl">{n}</dt>
              <dd className="max-w-[26ch] text-sm leading-snug text-muted-foreground sm:mt-2">{t}</dd>
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

      {/* How it works: three rows, screen and text alternating sides, one case from start to finish. */}
      <section aria-labelledby="how" className="mx-auto max-w-[1040px] py-16 sm:py-24">
        <h2 id="how" className="font-serif text-4xl font-medium text-primary sm:text-5xl">
          Upload once. Then <em>three</em> steps.
        </h2>
        <ol className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
          {STEPS.map((s, i) => (
            <li key={s.n} data-reveal="" className="grid items-center gap-8 md:grid-cols-12 md:gap-10">
              <div className={i % 2 === 1 ? "md:order-2 md:col-span-6 md:col-start-7" : "md:col-span-6"}>
                <span className="display font-serif text-4xl font-light leading-none text-primary/70 tnum sm:text-5xl" aria-hidden="true">
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
                  {/* The screen fades out at the bottom instead of being cut mid-sentence. */}
                  <div className="surface screen-fade max-h-[420px] overflow-hidden rounded-[calc(2rem-0.5rem)] bg-muted/40">
                    <Image src={s.img} alt={s.alt} placeholder="blur" sizes="(min-width: 768px) 380px, 90vw" className="h-auto w-full dark:hidden" />
                    <Image src={s.imgDark} alt="" aria-hidden="true" placeholder="blur" sizes="(min-width: 768px) 380px, 90vw" className="hidden h-auto w-full dark:block" />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* The trust argument, after the product has shown itself: the split of labor, its four proofs, and the line it never crosses. */}
      <section aria-labelledby="diff" data-reveal="" className="mx-auto max-w-[1040px] py-16 sm:py-24">
        <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:gap-16">
          <div>
            <h2 id="diff" className="font-serif text-4xl font-medium text-primary sm:text-5xl">
              The model reads. The code decides. You send.
            </h2>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
              An AI is good at reading a messy letter. It is the wrong tool for deciding which law applies, because it cannot be audited.
              So Overturn splits the job.
            </p>
          </div>
          <ul className="divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
            {PROOFS.map((f) => (
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
        <p className="mt-10 max-w-[70ch] text-lg leading-relaxed">
          <Scale className="mr-2 inline size-5 align-[-0.2em] text-primary" aria-hidden="true" />
          Overturn gives <strong className="font-medium">information, not legal advice</strong>: it never tells you what to do, never predicts whether an
          appeal will succeed, and never stores your document, which is read once, in memory, then discarded.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          State rules for California, New York, and Texas; the federal baseline everywhere else.{" "}
          <Link href="/about" className="text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary">
            Read how it works and why
          </Link>
          .
        </p>
      </section>

      {/* Final CTA: the same two actions as the hero, same names. */}
      <section data-reveal="" className="mx-auto max-w-[1040px] py-12 sm:py-20">
        <div className="rounded-[2rem] bg-primary p-8 text-primary-foreground shadow-[var(--shadow-lift)] sm:p-14 dark:bg-card dark:text-foreground dark:ring-1 dark:ring-primary/40">
          <div className="grid items-end gap-8 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <h2 className="font-serif text-4xl font-medium sm:text-5xl">Have a denial in hand?</h2>
              <p className="mt-4 max-w-[46ch] text-lg text-primary-foreground/85 dark:text-muted-foreground">
                Read it with Overturn in about a minute, or try one of seven fictional samples first.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:justify-end">
              <Button variant="secondary" className="group h-14 pl-7 pr-2 text-base dark:bg-primary dark:text-primary-foreground dark:hover:bg-[color-mix(in_oklch,var(--primary),white_10%)]" nativeButton={false} render={<Link href="/start?mode=upload" />}>
                Start with my document
                <span className="ml-3 flex size-10 items-center justify-center rounded-full bg-primary/10 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight aria-hidden="true" className="size-5" />
                </span>
              </Button>
              <Button
                variant="ghost"
                className="h-14 px-6 text-base text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground dark:text-primary dark:hover:bg-secondary dark:hover:text-primary"
                nativeButton={false}
                render={<Link href="/start?mode=sample" />}
              >
                Try a sample first
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
