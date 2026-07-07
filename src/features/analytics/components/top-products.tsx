"use client";

import { ImageIcon } from "lucide-react";
import type { ProductRank } from "@/features/analytics/aggregations";
import { formatBRL } from "@/lib/utils/money";

/** Ranking of best-selling products by units sold. */
export function TopProducts({ items }: { items: ProductRank[] }) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <h3 className="text-headline-md text-on-surface">Top Produtos</h3>
      {items.length === 0 ? (
        <p className="mt-md text-body-md text-on-surface-variant">
          Ainda sem vendas registradas.
        </p>
      ) : (
        <ul className="mt-md space-y-md">
          {items.map((p, idx) => {
            const max = items[0].unitsSold || 1;
            const pct = Math.round((p.unitsSold / max) * 100);
            return (
              <li key={p.productId} className="flex items-center gap-md">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-on-surface-variant/40" strokeWidth={1.5} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-medium text-on-surface">
                    {p.name}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {p.unitsSold} vendidos · {formatBRL(p.revenueCents)}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-container">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-label-md font-semibold text-on-surface-variant">
                  #{idx + 1}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
