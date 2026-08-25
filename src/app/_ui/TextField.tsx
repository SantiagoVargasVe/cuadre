import * as React from "react";
import { cn } from "../../lib/cn";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

/** Base UI has no text-input primitive (see design-system.md's list) — this is a plain styled input. */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const inputId = id ?? props.name;
    const errorId = error ? `${inputId}-error` : undefined;
    const hintId = hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground",
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
TextField.displayName = "TextField";
