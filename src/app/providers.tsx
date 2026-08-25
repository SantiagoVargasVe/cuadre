"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "./_ui/Toast";

/**
 * Dark mode is class-driven (see globals.css § @custom-variant dark).
 * next-themes sets `.dark` on <html>; suppressHydrationWarning on <html>
 * in layout.tsx pairs with this to avoid a first-paint flash.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
