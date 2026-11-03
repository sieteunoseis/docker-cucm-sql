import { extractVariables } from "@shared/variables";
import { cn } from "@/lib/utils";

interface Props {
  sql: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function VariablesBar({ sql, values, onChange }: Props) {
  const variables = extractVariables(sql);
  if (variables.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
      <span
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        title="Values are always sent as quoted strings ('value'). Informix converts them for numeric comparisons, but not where a bare number is required (e.g. FIRST :n)."
      >
        Variables
      </span>
      {variables.map((v) => {
        const value = values[v.name] ?? v.defaultValue;
        const missing = !value && !v.defaultValue;
        return (
          <label key={v.name} className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">:{v.name}</span>
            <input
              type="text"
              aria-label={`:${v.name}`}
              aria-invalid={missing}
              value={value}
              onChange={(e) => onChange({ ...values, [v.name]: e.target.value })}
              placeholder={v.defaultValue || v.name}
              className={cn(
                "h-7 w-44 rounded border border-border bg-background px-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring",
                missing && "border-destructive ring-1 ring-destructive/40",
              )}
            />
          </label>
        );
      })}
    </div>
  );
}
