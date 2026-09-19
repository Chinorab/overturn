"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpDrawer } from "@/components/help-drawer";
import { ThemeToggle } from "@/components/theme-toggle";

const STEPS = [
  { href: "/start", label: "Upload" },
  { href: "/understand", label: "Understand" },
  { href: "/rights", label: "Rights" },
  { href: "/letter", label: "Letter" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      {/* A floating glass island rather than an edge-to-edge bar: the page shows through around it. */}
      <div className="mx-auto flex h-13 max-w-[1040px] items-center justify-between gap-3 rounded-full bg-card/75 pl-5 pr-2 shadow-[inset_0_1px_0_var(--highlight),0_0_0_1px_var(--hairline),var(--shadow-ambient)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/65">
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex min-h-11 items-center font-serif text-[1.35rem] font-semibold tracking-tight text-primary" style={{ fontVariationSettings: '"opsz" 32, "SOFT" 40' }}>
            Overturn
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-1 text-sm sm:flex">
            <NavLink href="/learn">How appeals work</NavLink>
            <NavLink href="/about">About</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-1">
          <HelpDrawer />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full px-3 transition-[background-color,color] duration-300 ease-[var(--ease-out-expo)] hover:bg-muted hover:text-foreground",
        active ? "bg-secondary font-semibold text-secondary-foreground" : "text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}

const FLOW = ["/start", "/understand", "/rights", "/letter"];

export function Stepper() {
  const pathname = usePathname();
  if (!FLOW.includes(pathname)) return null;
  const current = Math.max(
    0,
    STEPS.findIndex((s) => pathname.startsWith(s.href)),
  );
  return (
    <nav aria-label="Progress" className="mx-auto w-full max-w-[680px] px-4 pt-6">
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          return (
            <li key={s.href} className="min-w-0">
              <span
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex h-1.5 w-full rounded-full transition-colors duration-500 ease-[var(--ease-out-expo)]",
                  state === "done" && "bg-success",
                  state === "current" && "bg-primary",
                  state === "todo" && "bg-border",
                )}
              />
              <span className={cn("mt-2 hidden items-center gap-1 text-xs sm:flex", state === "current" ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {state === "done" && <Check className="size-3.5 text-success" aria-hidden="true" />}
                <span className="truncate">{s.label}</span>
                <span className="sr-only">{state === "done" ? ", completed" : state === "current" ? ", current step" : ", upcoming"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs font-semibold text-muted-foreground sm:hidden" aria-hidden="true">
        Step {current + 1} of {STEPS.length} · {STEPS[current].label}
      </p>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16">
      <div className="mx-auto max-w-[1040px] px-4 pb-10 pt-8 text-sm text-muted-foreground">
        <div className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-[var(--hairline)] to-transparent" aria-hidden="true" />
        <p className="max-w-[62ch]">
          Overturn provides general legal information for people in the United States. It is not a lawyer, does not give legal
          advice, and cannot predict the outcome of an appeal. Documents are processed in memory and never stored.
        </p>
        <p className="mt-3">
          <Link href="/learn" className="underline underline-offset-4 decoration-primary/40">
            How appeals work
          </Link>
          {" · "}
          <Link href="/about" className="underline underline-offset-4 decoration-primary/40">
            About
          </Link>
          {" · "}
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

/** A short fade-and-rise on each step change; disabled by prefers-reduced-motion in globals.css. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/";
  return (
    <div key={pathname} className={cn("mx-auto w-full animate-in fade-in-0 slide-in-from-bottom-3 duration-500 ease-[var(--ease-out-expo)]", wide ? "max-w-[1040px]" : "max-w-[680px]")}>
      {children}
    </div>
  );
}
