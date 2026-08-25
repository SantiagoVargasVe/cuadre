import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "../../lib/cn";

export const SelectRoot = BaseSelect.Root;

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Trigger>) {
  return (
    <BaseSelect.Trigger
      className={cn(
        "flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm",
        "data-[placeholder]:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <BaseSelect.Icon className="text-muted-foreground">
        <ChevronIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export const SelectValue = BaseSelect.Value;

export function SelectContent({ children }: { children: React.ReactNode }) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner sideOffset={4} className="z-50 outline-none">
        <BaseSelect.Popup
          className="max-h-64 overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {children}
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseSelect.Item>) {
  return (
    <BaseSelect.Item
      className={cn(
        "flex cursor-default items-center justify-between rounded px-2 py-1.5 text-sm",
        "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <BaseSelect.ItemText>{children}</BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 12 8" className="size-3" fill="none" aria-hidden>
      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
