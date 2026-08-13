"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getToolAccessAction,
  setToolAccessAction,
} from "@/features/settings/actions/settings";
import {
  DEFAULT_TOOL_ACCESS,
  allowedByRole,
  resolveToolAccess,
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
 * admin usa para trancar/destrancar por loja.
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

  const toggle = useMutation({
    mutationFn: (vars: { tool: ToolKey; enabled: boolean | null }) => {
      if (!storeId) {
        throw new Error(
          "Selecione uma loja específica no seletor para alterar o acesso.",
        );
      }
      return setToolAccessAction(storeId, vars.tool, vars.enabled);
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
     * Estado do cadeado na visão do admin. Três estados, e não dois, porque
     * "sem override" é diferente de "liberado": Relatórios no padrão já vale
     * para lojista e não vale para vendedora — um booleano só não expressa
     * isso sem mentir sobre um dos dois papéis.
     */
    lockState: (tool: ToolKey): LockState => {
      const o = access[tool];
      if (o === true) return "liberado";
      if (o === false) return "bloqueado";
      return "padrao";
    },
    /** Quem enxerga a ferramenta quando não há override (para o tooltip). */
    defaultHint: (tool: ToolKey) => {
      const papeis = (["lojista", "vendedora"] as const).filter((r) =>
        allowedByRole(tool, r),
      );
      if (papeis.length === 2) return "lojista e vendedora";
      if (papeis.length === 1) return papeis[0];
      return "ninguém além do admin";
    },
    toggle,
  };
}

/** liberado = todos da loja; bloqueado = ninguém; padrao = segue o papel. */
export type LockState = "liberado" | "bloqueado" | "padrao";

/** Ciclo do clique do admin: padrão → liberado → bloqueado → padrão. */
export function nextLockState(atual: LockState): boolean | null {
  if (atual === "padrao") return true;
  if (atual === "liberado") return false;
  return null;
}
