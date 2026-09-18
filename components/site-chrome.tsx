"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpDrawer } from "@/components/help-drawer";

const STEPS = [
  { href: "/", label: "Upload" },
  { href: "/understand", label: "Understand" },
  { href: "/rights", label: "Rights" },
  { href: "/letter", label: "Letter" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex h-14 max-w-[680px] items-center justify-between gap-3 px-4">
        <Link href="/" className="font-semibold tracking-tight text-primary">
          Overturn
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Information, not legal advice</span>
          <HelpDrawer />
        </div>
      </div>
    </header>
  );
}

export function Stepper() {
  const pathname = usePathname();
  const current = Math.max(
    0,
    STEPS.findIndex((s) => (s.href === "/" ? pathname === "/" : pathname.startsWith(s.href))),
  );
  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-[680px] px-4 pt-5">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={s.href} className="flex flex-1 items-center gap-2">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "done" && "border-success bg-success text-success-foreground",
                  state === "current" && "border-primary bg-primary text-primary-foreground",
                  state === "todo" && "border-border bg-card text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                <span className="sr-only">{state === "done" ? "completed" : state === "current" ? "current step" : "upcoming"}</span>
              </span>
              <span className={cn("text-sm", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground", "hidden sm:inline")}>{s.label}</span>
              {i < STEPS.length - 1 && <span aria-hidden="true" className={cn("h-px flex-1", i < current ? "bg-success" : "bg-border")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm font-semibold sm:hidden" aria-hidden="true">
        Step {current + 1} of {STEPS.length}: {STEPS[current].label}
      </p>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t">
      <div className="mx-auto max-w-[680px] px-4 py-6 text-sm text-muted-foreground">
        <p>
          Overturn provides general legal information for people in the United States. It is not a lawyer, does not give legal
          advice, and cannot predict the outcome of an appeal. Documents are processed in memory and never stored.
        </p>
        <p className="mt-2">
          Source code on{" "}
          <a className="underline underline-offset-4" href="https://github.com/Chinorab/overturn">
            GitHub
          </a>
          . Built for LexHack 2026.
        </p>
      </div>
    </footer>
  );
}
