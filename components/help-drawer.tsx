"use client";

import { LifeBuoy, Phone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HELP_RESOURCES } from "@/lib/rules/load";
import { useSession } from "@/lib/session";
import { isSupportedState } from "@/lib/schemas/core";
import type { HelpResource } from "@/lib/rules/schema";

const KIND_LABEL: Record<HelpResource["kind"], string> = {
  CAP: "Free consumer help",
  regulator: "State or federal regulator",
  ombudsman: "Ombudsman",
  helpdesk: "Help desk",
};

/**
 * Always-available exit to a human. Content follows the state the user has chosen (or
 * the one read from the document); federal resources are always listed.
 */
export function HelpDrawer() {
  const { session } = useSession();
  const state = session.answers?.state ?? session.extraction?.state_hint.value ?? null;
  const supported = state ? isSupportedState(state) : false;
  const resources = HELP_RESOURCES.filter((h) => h.scope === "federal" || h.scope === state).sort((a, b) => {
    const s = (h: HelpResource) => (h.scope !== "federal" ? 2 : 0) + (h.kind === "CAP" ? 1 : 0);
    return s(b) - s(a);
  });

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" className="h-10 gap-2 px-3" />}>
        <LifeBuoy aria-hidden="true" />
        <span className="hidden sm:inline">Get free human help</span>
        <span className="sm:hidden">Human help</span>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Talk to a person</SheetTitle>
          <SheetDescription>
            These services are free. They can look at your documents, explain your options, and in many cases file the
            appeal with you.
            {state && !supported ? ` Overturn does not yet have ${state}-specific listings; your state insurance department is the place to start.` : ""}
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-3 px-4 pb-6">
          {resources.map((h) => (
            <li key={h.id} className="rounded-xl border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {KIND_LABEL[h.kind]}
                {h.scope !== "federal" ? ` · ${h.scope}` : " · Federal"}
              </p>
              <p className="mt-1 font-semibold">{h.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{h.what_they_do}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                {h.phone && (
                  <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
                    <Phone className="size-4" aria-hidden="true" />
                    {h.phone}
                  </a>
                )}
                <a href={h.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline">
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Website
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
