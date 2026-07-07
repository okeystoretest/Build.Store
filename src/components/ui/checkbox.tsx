"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  className?: string;
}

/** Circular checkbox per the soft shape language. */
export function Checkbox({ checked, onChange, label, id, className }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn("flex cursor-pointer items-center gap-3 select-none", className)}
    >
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
          checked
            ? "border-primary bg-primary text-on-primary"
            : "border-outline bg-surface",
        )}
      >
        {checked && <Check className="h-4 w-4" strokeWidth={2.5} />}
      </button>
      {label && <span className="text-body-md text-on-surface">{label}</span>}
    </label>
  );
}
