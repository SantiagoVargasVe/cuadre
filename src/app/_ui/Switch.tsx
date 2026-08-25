import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "../../lib/cn";

export type SwitchProps = React.ComponentProps<typeof BaseSwitch.Root>;

/** The simplify-debts toggle lives on this. Checked state is `--primary`, never a money token. */
export function Switch({ className, ...props }: SwitchProps) {
  return (
    <BaseSwitch.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-muted transition-colors",
        "data-[checked]:bg-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform",
          "data-[checked]:translate-x-[18px]",
        )}
      />
    </BaseSwitch.Root>
  );
}
