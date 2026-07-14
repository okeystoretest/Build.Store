"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types/domain";
import { useLiveProductsQuery } from "@/features/inventory/hooks/use-live-products";
import { stockLevel } from "@/features/inventory/types";

export type ViewMode = "grid" | "list";

/**
 * Inventory list state: text search + view mode + derived stats, over the live
 * Dexie product source. Category filtering was removed per spec.
 */
export function useInventory() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const allQ = useLiveProductsQuery();
  const all = allQ.data;

  const products = useMemo<Product[]>(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [all, query]);

  const stats = useMemo(() => {
    const list = all ?? [];
    return {
      total: list.length,
      lowStock: list.filter((p) => stockLevel(p) !== "ok").length,
    };
  }, [all]);

  return {
    products,
    stats,
    query,
    setQuery,
    view,
    setView,
    loading: allQ.isPending,
  };
}
