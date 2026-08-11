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

const ACTIVE_STORE_KEY = "bs:active-store";

export function StoreProvider({ children }: { children: ReactNode }) {
  const { role, storeId, loading } = useAuth();
  const isAdmin = role === "admin";
  const queryClient = useQueryClient();

  // Não-admin: travado na própria loja. Admin: começa em "todas" (null),
  // hidratando a última escolha do localStorage.
  const [adminSelection, setAdminSelection] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    try {
      const saved = localStorage.getItem(ACTIVE_STORE_KEY);
      if (saved) setAdminSelection(saved);
    } catch {
      /* ignore */
    }
  }, [isAdmin]);

  const setActiveStoreId = useCallback(
    (id: string | null) => {
      if (!isAdmin) return;
      setAdminSelection(id);
      try {
        if (id) localStorage.setItem(ACTIVE_STORE_KEY, id);
        else localStorage.removeItem(ACTIVE_STORE_KEY);
      } catch {
        /* ignore */
      }
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
