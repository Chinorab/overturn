"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpDrawer } from "@/components/help-drawer";
import { ThemeToggle } from "@/components/theme-toggle";

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
        <div className="flex items-center gap-5">
          <Link href="/" className="font-semibold tracking-tight text-primary">
            Overturn
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-4 text-sm sm:flex">
            <NavLink href="/learn">How appeals work</NavLink>
            <NavLink href="/about">About</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-2">
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
      className={cn("inline-flex min-h-11 items-center underline-offset-4 hover:underline", active ? "font-semibold text-foreground underline" : "text-muted-foreground")}
    >
      {children}
    </Link>
  );
}

const FLOW = ["/", "/understand", "/rights", "/letter"];

export function Stepper() {
  const pathname = usePathname();
  if (!FLOW.includes(pathname)) return null;
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
  return (
    <div key={pathname} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      {children}
    </div>
  );
}
