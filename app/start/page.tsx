import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { IntakePanel } from "@/components/intake-panel";

export const metadata: Metadata = { title: "Start", description: "Upload a denial letter or Explanation of Benefits, or try a sample." };

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="pt-2">
        <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Free · Nothing stored · Information, not legal advice
        </p>
        <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-[1.15] text-primary sm:text-4xl">Your document</h1>
        <p className="mt-3 max-w-prose text-lg text-muted-foreground">
          A denial letter or an Explanation of Benefits, as a PDF or a photo. Or pick a fictional sample to see the whole flow without
          uploading anything.
        </p>
      </section>

      <section aria-labelledby="start" className="rounded-3xl border bg-muted/40 p-4 sm:p-6">
        <h2 id="start" className="mb-4 text-lg font-semibold">
          Start here
        </h2>
        <IntakePanel />
      </section>

    </div>
  );
}
