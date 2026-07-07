"use client";

import {
  CATEGORY_TABS,
  CATEGORY_LABELS,
  type CategoryFilter,
} from "@/features/inventory/types";
import { cn } from "@/lib/utils/cn";

interface CategoryTabsProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

/** Pill segmented control for category filtering. */
export function CategoryTabs({ value, onChange }: CategoryTabsProps) {
  return (
    <div
      className="flex gap-1 rounded-full bg-surface-container-low p-1"
      role="tablist"
    >
      {CATEGORY_TABS.map((cat) => {
        const active = value === cat;
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cat)}
            className={cn(
              "rounded-full px-5 py-2.5 text-label-md transition-colors",
              active
                ? "bg-surface-container-lowest text-primary shadow-level-1"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        );
      })}
    </div>
  );
}
