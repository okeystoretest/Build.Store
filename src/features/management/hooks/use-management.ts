"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listUsers,
  listCampaigns,
  listGoals,
} from "@/lib/db/management-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/**
 * Usuários, vendedoras, campanhas e metas ao vivo para a Gestão e o Dashboard.
 *
 * `loading` é verdadeiro enquanto QUALQUER uma das três consultas ainda está na
 * carga inicial (isPending). Isso evita que telas dependentes (ex.: Dashboard)
 * rendereizem com metas/vendedoras ainda vazias enquanto os pedidos já
 * chegaram — a race condition entre queries paralelas.
 */
export function useManagement() {
  useRealtimeInvalidation("profiles", queryKeys.users);
  useRealtimeInvalidation("campaigns", queryKeys.campaigns);
  useRealtimeInvalidation("goals", queryKeys.goals);

  const usersQ = useQuery({ queryKey: queryKeys.users, queryFn: listUsers });
  const campaignsQ = useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: listCampaigns,
  });
  const goalsQ = useQuery({ queryKey: queryKeys.goals, queryFn: listGoals });

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
