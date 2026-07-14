import type { Product } from "@/types/domain";

/** Stock health derived from a product's current level vs its threshold. */
export type StockLevel = "ok" | "low" | "out";

export function stockLevel(product: Product): StockLevel {
  if (product.stock <= 0) return "out";
  if (product.stock <= product.lowStockThreshold) return "low";
  return "ok";
}
