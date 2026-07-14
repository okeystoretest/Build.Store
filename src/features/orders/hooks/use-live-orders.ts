"use client";

import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/lib/db/order-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import type { Order } from "@/types/domain";

/**
 * Lista de pedidos do Supabase, mais recentes primeiro. Realtime na tabela
 * `orders` invalida a query a cada venda/estorno, de qualquer dispositivo.
 *
 * Retorna também o estado de carregamento para as telas só renderizarem quando
 * os dados estiverem completos. `data` é `undefined` enquanto carrega.
 */
export function useLiveOrdersQuery() {
  useRealtimeInvalidation("orders", queryKeys.orders);
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: listOrders,
  });
}

/** Conveniência: só a lista (undefined enquanto carrega). */
export function useLiveOrders(): Order[] | undefined {
  return useLiveOrdersQuery().data;
}
