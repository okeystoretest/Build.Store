"use client";

import { useQuery } from "@tanstack/react-query";
import { listCustomers } from "@/lib/db/customer-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/**
 * Lista de clientes ao vivo (tabela `customers`). Realtime mantém a lista e o
 * autocomplete do PDV atualizados entre dispositivos.
 */
export function useCustomers() {
  useRealtimeInvalidation("customers", queryKeys.customers);
  const query = useQuery({
    queryKey: queryKeys.customers,
    queryFn: listCustomers,
  });
  return {
    customers: query.data ?? [],
    loading: query.isPending,
    error: query.error ?? null,
  };
}
