"use client";

import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: { value: string; positive: boolean; note: string };
}

/** KPI card: label, large figure, tinted icon, optional trend delta. */
export function StatCard({ label, value, icon: Icon, delta }: StatCardProps) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <div className="flex items-start justify-between">
        <p className="text-label-md uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed/60 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2 text-display-lg text-primary">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 flex items-center gap-1.5 text-label-md",
            delta.positive ? "text-[#3ba55c]" : "text-error",
          )}
        >
          {delta.positive ? (
            <TrendingUp className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <TrendingDown className="h-4 w-4" strokeWidth={1.75} />
          )}
          {delta.value}
          <span className="text-on-surface-variant">{delta.note}</span>
        </p>
      )}
    </div>
  );
}
