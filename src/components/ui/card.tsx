import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Card — floating container with Level 1 ambient elevation, no hard border.
 * Large radius per the shape language.
 */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg bg-surface-container-lowest shadow-level-1",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
