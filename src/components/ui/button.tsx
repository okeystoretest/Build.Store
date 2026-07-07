"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Button — pill-shaped per the Serene Commerce shape language.
 * Primary uses the high-contrast primary color reserved for critical actions.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold text-label-md transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary/90",
        "primary-container":
          "bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim",
        secondary:
          "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80",
        ghost:
          "bg-transparent text-on-surface-variant hover:bg-surface-container",
        outline:
          "border border-primary-container bg-transparent text-primary hover:bg-primary-fixed/40",
        destructive: "bg-error text-on-error hover:bg-error/90",
      },
      size: {
        sm: "h-9 px-4 rounded-full",
        md: "h-12 px-6 rounded-full",
        lg: "h-14 px-8 rounded-full text-body-md",
        icon: "h-11 w-11 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
