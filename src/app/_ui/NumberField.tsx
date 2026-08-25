import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { cn } from "../../lib/cn";

export const NumberFieldRoot = BaseNumberField.Root;

/** The shares stepper. For money amounts, use <MoneyField> (T061) instead — never this. */
export function NumberField({
  className,
  ...props
}: React.ComponentProps<typeof BaseNumberField.Group>) {
  return (
    <BaseNumberField.Group
      className={cn(
        "flex h-10 items-center overflow-hidden rounded-md border border-input bg-background",
        className,
      )}
      {...props}
    >
      <BaseNumberField.Decrement
        className={cn(
          "flex h-full w-8 items-center justify-center text-muted-foreground",
          "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <MinusIcon />
      </BaseNumberField.Decrement>
      <BaseNumberField.Input
        className={cn(
          "h-full w-full flex-1 bg-transparent text-center text-sm tabular-nums outline-none",
        )}
      />
      <BaseNumberField.Increment
        className={cn(
          "flex h-full w-8 items-center justify-center text-muted-foreground",
          "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <PlusIcon />
      </BaseNumberField.Increment>
    </BaseNumberField.Group>
  );
}

function MinusIcon() {
  return (
    <svg viewBox="0 0 10 2" className="size-2.5" fill="none" aria-hidden>
      <path d="M0 1H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" fill="none" aria-hidden>
      <path d="M5 0V10M0 5H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
