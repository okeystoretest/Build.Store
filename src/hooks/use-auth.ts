"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient, type Query } from "@tanstack/react-query";
import { me, logoutAction } from "@/features/auth/actions/auth";
import {
  ANONYMOUS_SESSION,
  isSignedIn,
  type SessionSnapshot,
} from "@/features/auth/types";
import { queryKeys } from "@/lib/db/query-keys";

export interface AuthState extends SessionSnapshot {
  loading: boolean;
}

/** Chave única da sessão no cache — uma busca para o app inteiro. */
export const AUTH_QUERY_KEY = queryKeys.auth;

/**
 * Sessão atual + papel, resolvidos pela auth própria (Lucia).
 *
 * ## De onde vêm os dados
 *
 * O layout de `(app)` resolve a sessão NO SERVIDOR e semeia esta chave antes
 * do primeiro render (ver `components/providers/query-hydrator.tsx`). Quando o
 * hook monta, o dado correto já está no cache: o papel certo vale desde o
 * primeiro pixel. A action `me()` abaixo cobre só as revalidações — foco de
 * janela, reconexão, fim do `staleTime`.
 *
 * ## O bug que isto fecha
 *
 * A versão anterior era uma query cliente comum com `staleTime` de 5 minutos.
 * O `StoreProvider` morava no layout RAIZ, que também serve `/login` — então a
 * query rodava com o usuário ainda deslogado, `me()` respondia o retrato
 * anônimo (`userId: null`, `role: "vendedora"`) e isso era gravado como
 * SUCESSO. Login feito, `redirect()` navegava pelo roteador sem recarregar o
 * documento, o `QueryClient` sobrevivia, e todo mundo passava cinco minutos
 * lendo aquele retrato anônimo: sem seletor de loja, sem lista de lojas,
 * "apenas administradores podem gerenciar lojas" na cara do administrador.
 * `Ctrl+Shift+R` consertava porque destruía o cache junto com a página — e por
 * isso o problema voltava a cada novo acesso, em todos os papéis.
 *
 * Três travas, hoje:
 *   1. `StoreProvider` saiu do layout raiz e vive dentro de `(app)`: nada mais
 *      consulta a sessão na tela de login.
 *   2. O login não redireciona pelo roteador — navega o documento, com o cache
 *      limpo (ver `loginAction`).
 *   3. `staleTime` dinâmico: um retrato anônimo nasce VELHO, então nunca é
 *      servido do cache sem revalidar.
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
    // Sessão válida não muda no meio da navegação; refazer a busca a cada tela
    // só gastaria round-trip. Sessão ANÔNIMA, ao contrário, é sempre suspeita:
    // com staleTime 0 ela é revalidada em toda montagem, e jamais congela a
    // interface no papel mais baixo.
    staleTime: (query: Query<SessionSnapshot>) =>
      isSignedIn(query.state.data) ? 5 * 60_000 : 0,
    gcTime: 30 * 60_000,
    // Falha de rede aqui degrada o app inteiro para "vendedora": vale insistir.
    retry: 3,
    retryDelay: (tentativa) => Math.min(1000 * 2 ** tentativa, 4000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const state: AuthState = isSignedIn(data)
    ? { ...data, loading: false }
    : { ...ANONYMOUS_SESSION, loading: isPending };

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
