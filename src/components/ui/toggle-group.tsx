"use client";

import { cn } from "@/lib/utils/cn";

interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ToggleOption<T>[];
  className?: string;
  "aria-label"?: string;
}

/** Pill segmented control, reused for view-mode and small filters. */
export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  className,
  ...props
}: ToggleGroupProps<T>) {
  return (
    <div
      className={cn(
        // scrollbar-hide + overflow-x-auto: no mobile as abas rolam em vez de
        // serem cortadas na borda da tela.
        "flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-container-low p-1 scrollbar-slim",
        className,
      )}
      role="tablist"
      aria-label={props["aria-label"]}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-label-md transition-colors",
              active
                ? "bg-surface-container-lowest text-primary shadow-level-1"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
