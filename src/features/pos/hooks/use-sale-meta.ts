"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listSellers,
  listActiveCampaigns,
} from "@/lib/db/management-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/**
 * Vendedoras + campanhas ativas para os seletores do checkout. Realtime em
 * `profiles` e `campaigns` mantém as opções atualizadas — uma vendedora ou
 * campanha criada na Gestão aparece no PDV sem refresh.
 */
export function useSaleMeta() {
  useRealtimeInvalidation("profiles", queryKeys.users);
  useRealtimeInvalidation("campaigns", queryKeys.campaigns);

  const sellersQ = useQuery({
    queryKey: [...queryKeys.users, "sellers"],
    queryFn: listSellers,
  });
  const campaignsQ = useQuery({
    queryKey: [...queryKeys.campaigns, "active"],
    queryFn: listActiveCampaigns,
  });

  return {
    sellers: sellersQ.data ?? [],
    campaigns: campaignsQ.data ?? [],
  };
}
