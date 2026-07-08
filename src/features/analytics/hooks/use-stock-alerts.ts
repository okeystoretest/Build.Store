"use client";

import { useMemo } from "react";
import type { Product } from "@/types/domain";
import { useLiveProducts } from "@/features/inventory/hooks/use-live-products";

export interface StockAlerts {
  /** Itens com estoque no mínimo ou abaixo (stock <= threshold). */
  atMinimum: Product[];
  /**
   * Itens próximos do mínimo: acima do limite, porém dentro de uma margem
   * configurável acima dele (padrão 10%).
   */
  nearMinimum: Product[];
}

/**
 * Calcula os alertas de estoque para os cards de Relatórios.
 * `nearPct` é a margem (0.10 = 10%) acima do estoque mínimo que ainda conta
 * como "próximo do mínimo".
 */
export function useStockAlerts(nearPct = 0.1): StockAlerts {
  const products = useLiveProducts();

  return useMemo(() => {
    const list = products ?? [];
    const atMinimum: Product[] = [];
    const nearMinimum: Product[] = [];

    for (const p of list) {
      const min = p.lowStockThreshold;
      if (p.stock <= min) {
        atMinimum.push(p);
      } else if (p.stock <= Math.ceil(min * (1 + nearPct)) && p.stock > min) {
        nearMinimum.push(p);
      }
    }

    return { atMinimum, nearMinimum };
  }, [products, nearPct]);
}
