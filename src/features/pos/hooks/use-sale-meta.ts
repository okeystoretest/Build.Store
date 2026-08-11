"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listSellers,
  listActiveCampaigns,
} from "@/lib/db/management-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useActiveStoreId } from "@/features/stores/store-context";

/**
 * Vendedoras + campanhas ativas para os seletores do checkout, escopadas pela
 * loja ativa. Realtime em `profiles` e `campaigns` mantém as opções atualizadas.
 */
export function useSaleMeta() {
  const storeId = useActiveStoreId();
  useRealtimeInvalidation("profiles", queryKeys.users);
  useRealtimeInvalidation("campaigns", queryKeys.campaigns);

  const sellersQ = useQuery({
    queryKey: [...queryKeys.users, "sellers", storeId],
    queryFn: () => listSellers(storeId),
  });
  const campaignsQ = useQuery({
    queryKey: [...queryKeys.campaigns, "active", storeId],
    queryFn: () => listActiveCampaigns(storeId),
  });

  return {
    sellers: sellersQ.data ?? [],
    campaigns: campaignsQ.data ?? [],
  };
}
