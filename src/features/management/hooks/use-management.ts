"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listUsersAction,
  listCampaignsAction,
  listGoalsAction,
} from "@/features/management/actions/management";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useActiveStoreId } from "@/features/stores/store-context";

/**
 * Usuários, vendedoras, campanhas e metas ao vivo para a Gestão e o Dashboard,
 * escopados pela loja ativa (própria loja, ou a selecionada pelo admin).
 *
 * `loading` é verdadeiro enquanto QUALQUER uma das três consultas ainda está na
 * carga inicial (isPending). Isso evita que telas dependentes (ex.: Dashboard)
 * rendereizem com metas/vendedoras ainda vazias enquanto os pedidos já
 * chegaram — a race condition entre queries paralelas.
 */
export function useManagement() {
  const storeId = useActiveStoreId();
  useRealtimeInvalidation("profiles", queryKeys.users);
  useRealtimeInvalidation("campaigns", queryKeys.campaigns);
  useRealtimeInvalidation("goals", queryKeys.goals);

  const usersQ = useQuery({
    queryKey: [...queryKeys.users, storeId],
    queryFn: () => listUsersAction(storeId),
  });
  const campaignsQ = useQuery({
    queryKey: [...queryKeys.campaigns, storeId],
    queryFn: () => listCampaignsAction(storeId),
  });
  const goalsQ = useQuery({
    queryKey: [...queryKeys.goals, storeId],
    queryFn: () => listGoalsAction(storeId),
  });

  const users = usersQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];
  const goals = goalsQ.data ?? [];

  return {
    users: [...users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    sellers: users
      .filter((u) => u.role === "vendedora" && u.active)
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    campaigns: [...campaigns].sort((a, b) => a.name.localeCompare(b.name)),
    goals,
    // Carga inicial de qualquer uma das fontes ainda em andamento.
    loading: usersQ.isPending || campaignsQ.isPending || goalsQ.isPending,
    error: usersQ.error ?? campaignsQ.error ?? goalsQ.error ?? null,
  };
}
