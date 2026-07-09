"use client";

import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/lib/db/order-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import type { Order } from "@/types/domain";

/**
 * Lista de pedidos do Supabase, mais recentes primeiro. Realtime na tabela
 * `orders` invalida a query a cada venda/estorno, de qualquer dispositivo.
 * Retorna `undefined` enquanto carrega.
 */
export function useLiveOrders(): Order[] | undefined {
  useRealtimeInvalidation("orders", queryKeys.orders);

  const { data } = useQuery({
    queryKey: queryKeys.orders,
    queryFn: listOrders,
  });

  return data;
}
