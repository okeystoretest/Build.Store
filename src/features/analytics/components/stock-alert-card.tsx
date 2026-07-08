"use client";

import { type LucideIcon } from "lucide-react";
import type { Product } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

interface StockAlertCardProps {
  label: string;
  items: Product[];
  icon: LucideIcon;
  /** Tom do destaque: "critical" (atingiu o mínimo) ou "warning" (próximo). */
  tone: "critical" | "warning";
}

/**
 * Card de alerta de estoque para Relatórios. Mostra a contagem de itens e uma
 * lista compacta (referência + estoque atual vs. mínimo). Usado em dois modos:
 * itens no/abaixo do mínimo (crítico) e itens próximos do mínimo (aviso).
 */
export function StockAlertCard({ label, items, icon: Icon, tone }: StockAlertCardProps) {
  const accent =
    tone === "critical"
      ? "bg-error-container text-on-error-container"
      : "bg-[#f0e6a8] text-[#5c5310]";

  return (
    <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <div className="flex items-start justify-between">
        <p className="text-label-md uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            accent,
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>

      <p className="mt-2 text-display-lg text-primary">{items.length}</p>

      {items.length > 0 ? (
        <ul className="mt-sm space-y-1">
          {items.slice(0, 4).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-label-md"
            >
              <span className="truncate text-on-surface-variant">
                {p.sku} · {p.name}
              </span>
              <span
                className={cn(
                  "shrink-0 tabular-nums",
                  tone === "critical" ? "text-error" : "text-on-surface-variant",
                )}
              >
                {p.stock}/{p.lowStockThreshold}
              </span>
            </li>
          ))}
          {items.length > 4 && (
            <li className="text-label-sm text-on-surface-variant/70">
              +{items.length - 4} outros
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-sm text-label-md text-on-surface-variant/70">
          Nenhum item nesta condição.
        </p>
      )}
    </div>
  );
}
