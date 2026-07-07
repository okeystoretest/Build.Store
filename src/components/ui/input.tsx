import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Input — 56px tall, pill-shaped, subtle fill. Border shifts to primary on
 * focus per the design system.
 */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-14 w-full rounded-full border border-outline-variant bg-surface px-6 text-body-md text-on-surface placeholder:text-on-surface-variant/60 transition-colors focus:border-primary-container focus:outline-none",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
