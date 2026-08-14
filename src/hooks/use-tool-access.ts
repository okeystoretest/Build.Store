"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getToolAccessAction,
  setToolAccessAction,
} from "@/features/settings/actions/settings";
import {
  DEFAULT_TOOL_ACCESS,
  TOOL_BY_KEY,
  roleUnlocked,
  resolveToolAccess,
  type LockableRole,
  type RoleAccess,
  type ToolAccess,
  type ToolKey,
} from "@/features/settings/tool-access";
import { queryKeys } from "@/lib/db/query-keys";
import { useActiveStoreId } from "@/features/stores/store-context";
import { useAuth } from "@/hooks/use-auth";

/**
 * Cadeado das ferramentas da loja ativa.
 *
 * Devolve `can(tool)` — o acesso efetivo do usuário logado — e a mutação que o
 * admin usa para liberar/bloquear por papel, a partir do modal do cadeado.
 *
 * Sem loja ativa (admin em "todas as lojas") não há o que editar: a liberação é
 * sempre POR loja, então `canToggle` fica falso.
 */
export function useToolAccess() {
  const storeId = useActiveStoreId();
  const { role, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: [...queryKeys.settings, "tool-access", storeId],
    queryFn: () => getToolAccessAction(storeId),
    staleTime: 30_000,
  });

  const access: ToolAccess = data ?? DEFAULT_TOOL_ACCESS;

  const save = useMutation({
    mutationFn: (vars: { tool: ToolKey; papeis: RoleAccess }) => {
      if (!storeId) {
        throw new Error(
          "Selecione uma loja específica no seletor para alterar o acesso.",
        );
      }
      return setToolAccessAction(storeId, vars.tool, vars.papeis);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  return {
    /** Overrides crus da loja (usado pelo admin para desenhar o cadeado). */
    access,
    loading: isPending || authLoading,
    canToggle: Boolean(storeId),
    /** Acesso efetivo do usuário logado a uma ferramenta. */
    can: (tool: ToolKey) => resolveToolAccess(tool, role, access),
    /**
     * Estado exibido no modal para um papel: liberado (true) ou bloqueado
     * (false). Sem override, mostra o que o papel já dá — nunca um terceiro
     * estado abstrato.
     */
    unlockedFor: (tool: ToolKey, papel: LockableRole) =>
      roleUnlocked(tool, papel, access),
    /** false quando o cadeado não pode LIBERAR a ferramenta (só `stores`). */
    isUnlockable: (tool: ToolKey) => TOOL_BY_KEY[tool]?.unlockable ?? false,
    /** Grava o resultado do modal. */
    save,
  };
}
