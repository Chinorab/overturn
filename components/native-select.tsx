import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A native <select>, styled. Native pickers are the most usable control on phones and
 * the most reliable with screen readers, which matters more here than a custom look.
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-base text-foreground focus-visible:outline-3 focus-visible:outline-ring",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

export function TextInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-3 focus-visible:outline-ring",
        className,
      )}
    />
  );
}
