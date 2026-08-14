"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { me, logoutAction } from "@/features/auth/actions/auth";
import type { Role } from "@/types/domain";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  fullName: string | null;
  photoUrl: string | null;
  role: Role;
  /** Loja do usuário. null = admin global (todas as lojas). */
  storeId: string | null;
}

/** Chave única da sessão no cache — uma busca para o app inteiro. */
export const AUTH_QUERY_KEY = ["auth", "me"] as const;

const ANONIMO: AuthState = {
  loading: false,
  userId: null,
  fullName: null,
  photoUrl: null,
  role: "vendedora",
  storeId: null,
};

/**
 * Sessão atual + papel, resolvidos pela auth própria (Lucia) via a server
 * action `me()`. O middleware protege as rotas por cookie; aqui buscamos o
 * profile para papel, nome e foto.
 *
 * ## Por que TanStack Query e não useState/useEffect
 *
 * Antes, CADA componente que chamava `useAuth()` mantinha o próprio estado e
 * disparava o próprio `me()` no mount — sidebar, StoreProvider, telas, gates.
 * Eram meia dúzia de POSTs concorrentes por navegação e, o pior, **sem
 * retentativa**: se um deles falhasse (rede instável, corrida com o cookie
 * recém-gravado no login), aquele componente ficava para sempre no padrão
 * `role: "vendedora"`. Era essa a causa do seletor de loja não aparecer logo
 * depois do login de admin e só surgir com Ctrl+Shift+R — a recarga refazia a
 * busca.
 *
 * Com uma query compartilhada há UMA busca, resultado único para todos os
 * consumidores e retentativa automática em caso de falha.
 *
 * Regras de acesso (por spec):
 * - vendedora: sem Relatórios, sem Gestão.
 * - lojista: tudo, exceto adicionar produtos ao estoque.
 * - admin: acesso total, incluindo adicionar estoque.
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => me(),
    // A sessão não muda no meio da navegação; refazer a busca a cada tela só
    // gastaria round-trip.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    // Falha de rede aqui degrada o app inteiro para "vendedora": vale insistir.
    retry: 3,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 4000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const state: AuthState = data
    ? {
        loading: false,
        userId: data.userId,
        fullName: data.fullName,
        photoUrl: data.photoUrl,
        role: data.role,
        storeId: data.storeId,
      }
    : { ...ANONIMO, loading: isPending };

  const { role } = state;

  // Permissões derivadas.
  const canSeeReports = role === "lojista" || role === "admin";
  const canSeeManagement = role === "lojista" || role === "admin";
  const canAddProducts = role === "admin"; // só admin adiciona estoque
  const canEditProducts = role === "lojista" || role === "admin";
  const canRefund = role === "lojista" || role === "admin";
  const isAdmin = role === "admin";
  const canUploadShowcase = role === "admin"; // só admin envia mídia na Vitrine

  const signOut = useCallback(async () => {
    // Limpa o cache antes de sair: sem isto, o próximo usuário a logar no mesmo
    // navegador veria por um instante os dados do anterior.
    queryClient.clear();
    await logoutAction();
    // logoutAction faz redirect no servidor; fallback client:
    window.location.href = "/login";
  }, [queryClient]);

  return {
    ...state,
    canSeeReports,
    canSeeManagement,
    canAddProducts,
    canEditProducts,
    canRefund,
    isAdmin,
    canUploadShowcase,
    signOut,
  };
}
