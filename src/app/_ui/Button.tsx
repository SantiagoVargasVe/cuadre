import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
} as const;

const sizes = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
} as const;

export interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

/** The one button. Compose variant + size rather than adding new components. */
export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
