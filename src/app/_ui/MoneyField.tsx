import * as React from "react";
import { formatAmountInput } from "../../lib/money/format";
import { cn } from "../../lib/cn";

export interface MoneyFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  hint?: string;
  /** Which currency this field is entering — decides whether a decimal
   * separator is even allowed and how many fraction digits follow it
   * (design-system.md § *Money display*: COP never shows centavos). */
  currency: string;
}

/**
 * The shared amount input (design-system.md § *Forms*). Reformats with
 * locale thousands separators as the user types — see
 * `src/lib/money/format.ts`'s `formatAmountInput` for the actual grouping
 * logic, kept there so it stays a plain, exhaustively-tested function
 * rather than living inside a component.
 *
 * Deliberately uncontrolled: it rewrites `event.target.value` in place
 * before delegating to the caller's own `onChange` (typically
 * react-hook-form's `register`), so `defaultValue` / `ref` keep working
 * exactly like `<TextField>`'s and nothing here fights react-hook-form's
 * own value tracking. The `bigint` conversion happens once, at the form's
 * `onSubmit` via `parseAmountInput` — never here.
 */
export const MoneyField = React.forwardRef<HTMLInputElement, MoneyFieldProps>(
  ({ label, error, hint, id, className, currency, onChange, ...props }, ref) => {
    const inputId = id ?? props.name;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
      event.target.value = formatAmountInput(event.target.value, currency);
      onChange?.(event);
    }

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          onChange={handleChange}
          className={cn(
            "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground tabular-nums",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-destructive",
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);
MoneyField.displayName = "MoneyField";
