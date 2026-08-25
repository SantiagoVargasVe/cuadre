"use client";

import * as React from "react";
import { Toast as BaseToast } from "@base-ui/react/toast";
import { cn } from "../../lib/cn";

/** Imperative toast API — `toastManager.add({ title, description, type })`. */
export const toastManager = BaseToast.createToastManager();

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <BaseToast.Provider toastManager={toastManager}>
      {children}
      <ToastViewport />
    </BaseToast.Provider>
  );
}

function ToastViewport() {
  const { toasts } = BaseToast.useToastManager();

  return (
    <BaseToast.Portal>
      <BaseToast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <BaseToast.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "relative rounded-md border border-border bg-card p-4 pr-8 text-card-foreground shadow-lg",
              "data-[type=error]:border-debit",
            )}
          >
            <BaseToast.Title className="text-sm font-medium" />
            <BaseToast.Description className="text-sm text-muted-foreground" />
            <BaseToast.Close
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <CloseIcon />
            </BaseToast.Close>
          </BaseToast.Root>
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 10 10" className="size-3" fill="none" aria-hidden>
      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
