"use client";

import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/db/customer-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useActiveStoreId } from "@/features/stores/store-context";

/**
 * Lista de clientes ao vivo (tabela `customers`), escopada pela loja ativa.
 * Realtime mantém a lista e o autocomplete do PDV atualizados entre dispositivos.
 */
export function useCustomers() {
  const storeId = useActiveStoreId();
  useRealtimeInvalidation("customers", queryKeys.customers);
  const query = useQuery({
    queryKey: [...queryKeys.customers, storeId],
    queryFn: () => listCustomers(storeId),
  });
  return {
    customers: query.data ?? [],
    loading: query.isPending,
    error: query.error ?? null,
  };
}
