"use client";

import { useState } from "react";
import { AlertCircle, Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Field } from "@/lib/schemas/extraction";
import { CONFIDENCE_AUTO_ACCEPT } from "@/lib/schemas/extraction";

/**
 * One extracted fact. The trust mechanic: every value can show the exact words it came
 * from. Low-confidence values are flagged with icon + text, never by color alone.
 */
export function FactCard({
  label,
  field,
  format,
  editor,
  required = false,
}: {
  label: string;
  field: Field<unknown>;
  format?: (v: unknown) => string;
  editor?: React.ReactNode;
  required?: boolean;
}) {
  const [showQuote, setShowQuote] = useState(false);
  const absent = field.value === null;
  const low = !absent && field.confidence < CONFIDENCE_AUTO_ACCEPT;
  const needsAttention = required && (absent || low);
  const display = absent ? "Not found in the document" : format ? format(field.value) : String(field.value);

  return (
    <div className={cn("rounded-xl border bg-card p-4", needsAttention && "border-warning/70")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={cn("mt-1 break-words text-base", absent && "italic text-muted-foreground")}>{display}</p>
        </div>
        {!absent && field.quote && (
          <button
            type="button"
            onClick={() => setShowQuote((v) => !v)}
            aria-expanded={showQuote}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-primary underline-offset-4 hover:underline"
          >
            <Quote className="size-4" aria-hidden="true" />
            {showQuote ? "Hide source" : "Where is this from?"}
          </button>
        )}
      </div>

      {showQuote && field.quote && (
        <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 font-serif text-sm text-muted-foreground">
          “{field.quote}”{field.page ? <span className="ml-2 font-sans text-xs">— page {field.page}</span> : null}
        </blockquote>
      )}

      {(low || (required && absent)) && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-warning">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {absent ? "This is needed for the next step. Please add it below." : "Overturn is not sure about this one. Please check it."}
        </p>
      )}

      {editor && <div className="mt-3">{editor}</div>}
    </div>
  );
}
