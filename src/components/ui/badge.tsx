import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-label-sm font-semibold uppercase tracking-wide",
  {
    variants: {
      tone: {
        success: "bg-[#d7f0dd] text-[#1f7a3d]",
        error: "bg-error-container text-on-error-container",
        neutral: "bg-surface-container text-on-surface-variant",
        primary: "bg-primary-container text-on-primary-container",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
