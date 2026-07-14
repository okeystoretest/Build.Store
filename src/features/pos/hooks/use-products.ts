"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/types/domain";

/**
 * Product search over a supplied catalogue. The source comes from the live
 * Dexie query (useLiveProducts), so results reflect real stock and update as
 * sales happen. Pure filtering here keeps it easy to test.
 */
export function useProducts(source: Product[]) {
  const [query, setQuery] = useState("");

  const results = useMemo<Product[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode?.includes(q),
    );
  }, [source, query]);

  const findByCode = (code: string): Product | undefined => {
    const c = code.trim().toLowerCase();
    if (!c) return undefined;
    return source.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === c,
    );
  };

  return { products: results, query, setQuery, findByCode };
}
