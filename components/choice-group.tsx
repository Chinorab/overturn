import { cn } from "@/lib/utils";

type Option<T extends string> = { value: T; label: string; hint?: string };

/**
 * A question with big, tappable radio cards. Native radios underneath so keyboard
 * arrows, screen readers, and form semantics all work without extra code.
 */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  help,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  help?: React.ReactNode;
  options: Option<T>[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="rounded-2xl border bg-card p-5">
      <legend className="px-1 text-base font-semibold">{legend}</legend>
      {help && <div className="mt-1 text-sm text-muted-foreground">{help}</div>}
      <div className={cn("mt-3 grid gap-2", options.length > 2 ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        {options.map((o) => {
          const id = `${name}-${o.value}`;
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              htmlFor={id}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-ring",
                checked ? "border-primary bg-secondary/60" : "hover:border-primary/50",
              )}
            >
              <input id={id} type="radio" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} className="mt-1 size-4 shrink-0 accent-primary" />
              <span>
                <span className="block font-medium">{o.label}</span>
                {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
