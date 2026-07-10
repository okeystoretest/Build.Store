"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/db/product-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import type { Product } from "@/types/domain";

/**
 * Produtos do Supabase com Realtime. Expõe também o estado de carregamento para
 * as telas aguardarem os dados completos antes de renderizar.
 */
export function useLiveProductsQuery() {
  useRealtimeInvalidation("products", queryKeys.products);
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: listProducts,
  });
}

/** Conveniência: só a lista (undefined enquanto carrega). */
export function useLiveProducts(): Product[] | undefined {
  return useLiveProductsQuery().data;
}
