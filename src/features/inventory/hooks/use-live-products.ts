"use client";

import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/lib/db/product-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import type { Product } from "@/types/domain";

/**
 * Lista de produtos do Supabase. TanStack Query cuida do cache e dos estados de
 * carregamento; o Realtime invalida a query quando o catálogo/estoque muda em
 * qualquer dispositivo, então a grade de estoque e o PDV convergem ao vivo —
 * uma venda que baixa o estoque reflete aqui sem refetch manual.
 *
 * Retorna `undefined` enquanto carrega (mesma semântica do hook anterior, para
 * as telas não precisarem mudar).
 */
export function useLiveProducts(): Product[] | undefined {
  useRealtimeInvalidation("products", queryKeys.products);

  const { data } = useQuery({
    queryKey: queryKeys.products,
    queryFn: listProducts,
  });

  return data;
}
