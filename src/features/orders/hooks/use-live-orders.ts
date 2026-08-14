"use client";

import { useQuery } from "@tanstack/react-query";
import { listOrdersAction } from "@/features/orders/actions/orders";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useActiveStoreId } from "@/features/stores/store-context";
import type { Order } from "@/types/domain";

/**
 * Lista de pedidos, mais recentes primeiro. Realtime na tabela `orders`
 * invalida a query a cada venda/estorno, de qualquer dispositivo.
 *
 * Escopada pela loja ativa: null = todas (admin consolidado), uuid = uma loja.
 * Sem esse escopo, trocar de loja no seletor não mexia no Dashboard nem no
 * histórico — as duas telas seguiam somando a marca inteira para o admin.
 *
 * Retorna também o estado de carregamento para as telas só renderizarem quando
 * os dados estiverem completos. `data` é `undefined` enquanto carrega.
 */
export function useLiveOrdersQuery() {
  const storeId = useActiveStoreId();
  useRealtimeInvalidation("orders", queryKeys.orders);
  return useQuery({
    queryKey: [...queryKeys.orders, storeId],
    // Arrow function obrigatória: passar a Server Action direto faz o React
    // Query chamá-la com o QueryFunctionContext (AbortSignal, QueryClient),
    // que não é serializável — a query quebraria com "Only plain objects...".
    queryFn: () => listOrdersAction(storeId),
  });
}

/** Conveniência: só a lista (undefined enquanto carrega). */
export function useLiveOrders(): Order[] | undefined {
  return useLiveOrdersQuery().data;
}
