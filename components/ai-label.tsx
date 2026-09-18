import { Sparkles, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Provenance labels. Every generated statement is marked as AI-assisted; every rule is
 * marked as coming from the rules dataset (with its source). Never color-only.
 */
export function AiLabel({ className, what = "Written by AI from your document" }: { className?: string; what?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground", className)}>
      <Sparkles className="size-3.5" aria-hidden="true" />
      {what}
    </span>
  );
}

export function RuleLabel({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs text-muted-foreground", className)}>
      <ScrollText className="size-3.5" aria-hidden="true" />
      From the rules dataset, not AI
    </span>
  );
}
