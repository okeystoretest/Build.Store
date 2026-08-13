"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getToolAccessAction,
  setToolAccessAction,
} from "@/features/settings/actions/settings";
import {
  DEFAULT_TOOL_ACCESS,
  type ToolAccess,
  type UnlockableTool,
} from "@/features/settings/tool-access";
import { queryKeys } from "@/lib/db/query-keys";
import { useActiveStoreId } from "@/features/stores/store-context";

/**
 * Ferramentas liberadas para a loja ativa (o cadeado da sidebar), com a
 * mutação de liberar/trancar usada pelo admin.
 *
 * Sem loja ativa (admin em "todas as lojas") não há o que liberar: devolve o
 * padrão e `canToggle` falso — a liberação é sempre POR loja.
 */
export function useToolAccess() {
  const storeId = useActiveStoreId();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: [...queryKeys.settings, "tool-access", storeId],
    queryFn: () => getToolAccessAction(storeId),
    // Sem loja não há consulta útil, mas manter a query habilitada evita
    // estado indefinido na sidebar; a action já devolve o padrão.
    staleTime: 30_000,
  });

  const toggle = useMutation({
    mutationFn: (vars: { tool: UnlockableTool; enabled: boolean }) => {
      if (!storeId) {
        throw new Error(
          "Selecione uma loja específica no seletor para liberar ferramentas.",
        );
      }
      return setToolAccessAction(storeId, vars.tool, vars.enabled);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  return {
    access: data ?? DEFAULT_TOOL_ACCESS,
    loading: isPending,
    /** Só faz sentido liberar quando há uma loja específica em foco. */
    canToggle: Boolean(storeId),
    toggle,
  } satisfies {
    access: ToolAccess;
    loading: boolean;
    canToggle: boolean;
    toggle: ReturnType<typeof useMutation<ToolAccess, Error, { tool: UnlockableTool; enabled: boolean }>>;
  };
}
