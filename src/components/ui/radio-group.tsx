"use client";

import { cn } from "@/lib/utils/cn";

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  className?: string;
}

/** Circular radios per the design system. */
export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: RadioGroupProps<T>) {
  return (
    <div className={cn("flex gap-md", className)} role="radiogroup">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2 text-body-md text-on-surface"
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                active ? "border-primary" : "border-outline",
              )}
            >
              {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
