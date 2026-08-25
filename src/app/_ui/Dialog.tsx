import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "../../lib/cn";

export const DialogRoot = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;

/**
 * Full-screen sheet below 768px (Tailwind's `md`), a centered card above it.
 * Every modal in this app is used one-handed on a phone — see
 * design-system.md § Layout.
 */
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof BaseDialog.Popup>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
      <BaseDialog.Popup
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[90vh] w-full overflow-auto rounded-t-xl",
          "border-t border-border bg-card p-6 text-card-foreground shadow-lg",
          "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-md",
          "md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border",
          className,
        )}
        {...props}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}
