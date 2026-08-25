import * as React from "react";
import { RadioGroup as BaseRadioGroup, type RadioGroupProps as BaseRadioGroupProps } from "@base-ui/react/radio-group";
import { Radio as BaseRadio } from "@base-ui/react/radio";
import { cn } from "../../lib/cn";

export type RadioGroupProps<Value> = BaseRadioGroupProps<Value>;

/** The split-strategy picker (equal, shares, percentage, exact, loan) uses this. */
export function RadioGroup<Value>({ className, ...props }: RadioGroupProps<Value>) {
  return <BaseRadioGroup className={cn("flex flex-col gap-2", className)} {...props} />;
}

export interface RadioItemProps extends React.ComponentProps<typeof BaseRadio.Root> {
  label: React.ReactNode;
}

export function RadioItem({ label, className, ...props }: RadioItemProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <BaseRadio.Root
        className={cn(
          "flex size-5 items-center justify-center rounded-full border border-input bg-background",
          "data-[checked]:border-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <BaseRadio.Indicator className="size-2.5 rounded-full bg-primary" />
      </BaseRadio.Root>
      {label}
    </label>
  );
}
