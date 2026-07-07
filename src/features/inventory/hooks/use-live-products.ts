"use client";

import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { ensureSeeded } from "@/lib/db/product-repository";
import type { Product } from "@/types/domain";

/**
 * Live product list from Dexie. useLiveQuery re-renders whenever the underlying
 * table changes, so a sale that decrements stock updates the inventory grid and
 * the POS results instantly — no manual refetch. Seeds on first mount.
 */
export function useLiveProducts(): Product[] | undefined {
  useEffect(() => {
    void ensureSeeded();
  }, []);

  return useLiveQuery(() => db.products.orderBy("name").toArray(), []);
}
