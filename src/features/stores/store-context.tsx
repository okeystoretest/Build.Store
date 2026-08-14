"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

/**
 * Seletor global de loja (visão do admin) — Opção A: filtro de aplicação.
 *
 * O admin (store_id NULL no banco) enxerga todas as lojas pela RLS; este
 * contexto apenas NARROWa a visão dele para uma loja específica, ou "all"
 * (todas). Para lojista/vendedora o valor é sempre travado na própria loja e o
 * seletor nem aparece.
 *
 * `activeStoreId` é o que as telas usam para filtrar:
 *   - null  => "todas as lojas" (só admin).
 *   - uuid  => uma loja específica (admin escolheu, ou é a loja do usuário).
 *
 * Ao trocar de loja, invalidamos as queries para tudo recarregar no escopo novo.
 */

interface StoreContextValue {
  /** true se o usuário é admin (pode alternar entre lojas). */
  isAdmin: boolean;
  /** Loja ativa para filtragem. null = todas (admin em modo global). */
  activeStoreId: string | null;
  /** Admin: define a loja ativa (null = todas). No-op para não-admin. */
  setActiveStoreId: (id: string | null) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** Chave legada da última loja escolhida — não é mais lida, apenas limpa. */
const ACTIVE_STORE_KEY = "bs:active-store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { role, storeId, loading } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  // Não-admin: travado na própria loja.
  //
  // Admin: SEMPRE inicia em "Todas as lojas" (null). A escolha vale só para a
  // navegação atual e não é mais persistida — antes, a última loja selecionada
  // voltava do localStorage no carregamento seguinte e o admin abria o painel
  // vendo os números de uma unidade só, achando estar no consolidado da marca.
  // O padrão é o consolidado; restringir passa a ser uma ação explícita, que
  // ele continua podendo fazer no seletor a qualquer momento.
  const [adminSelection, setAdminSelection] = useState<string | null>(null);

  // Limpa o resquício da versão que persistia a escolha, para o valor antigo
  // não reaparecer em nenhum cenário.
  useEffect(() => {
    try {
      localStorage.removeItem(ACTIVE_STORE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setActiveStoreId = useCallback(
    (id: string | null) => {
      if (!isAdmin) return;
      setAdminSelection(id);
      // Recarrega tudo no novo escopo de loja.
      queryClient.invalidateQueries();
    },
    [isAdmin, queryClient],
  );

  // Enquanto o perfil carrega, mantém null (evita piscar dados de outra loja).
  const activeStoreId = loading
    ? null
    : isAdmin
      ? adminSelection
      : (storeId ?? null);

  return (
    <StoreContext.Provider
      value={{ isAdmin, activeStoreId, setActiveStoreId }}
    >
      {children}
    </StoreContext.Provider>
  );
}

/** Acessa o seletor global de loja. */
export function useStoreContext(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStoreContext deve ser usado dentro de <StoreProvider>");
  }
  return ctx;
}

/**
 * Conveniência: a loja ativa para filtrar leituras e carimbar escritas.
 * - lojista/vendedora: a própria loja.
 * - admin: a loja selecionada, ou null em "todas as lojas".
 */
export function useActiveStoreId(): string | null {
  return useStoreContext().activeStoreId;
}
