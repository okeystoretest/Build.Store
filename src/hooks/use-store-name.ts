"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreNameAction } from "@/features/settings/actions/settings";
import { DEFAULT_STORE_NAME } from "@/features/settings/constants";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useStoreContext } from "@/features/stores/store-context";
import { useAuth } from "@/hooks/use-auth";

/**
 * Nome da loja ATIVA. Para lojista/vendedora é a própria loja; para admin é a
 * loja selecionada no seletor global (ou o padrão quando em "todas as lojas").
 * Realtime na tabela `settings` propaga alterações para todos os dispositivos.
 *
 * O nome que veio na sessão (`me()`) entra como valor imediato: a query só
 * pode rodar depois que o `StoreContext` conhece o `storeId`, e nesse intervalo
 * o cabeçalho da vendedora/lojista mostrava o nome genérico do produto no lugar
 * do nome da loja dela.
 */
export function useStoreName(): string {
  const { activeStoreId } = useStoreContext();
  const { storeId: sessionStoreId, storeName: sessionStoreName } = useAuth();
  useRealtimeInvalidation("settings", ["settings"]);

  const { data } = useQuery({
    queryKey: ["settings", "name", activeStoreId],
    queryFn: () => getStoreNameAction(activeStoreId),
    // Sem loja ativa (admin consolidado) não há nome a buscar.
    enabled: Boolean(activeStoreId),
  });

  // Vale como ponte apenas quando a loja em foco é a da própria sessão — ou
  // enquanto o contexto ainda não resolveu o storeId do usuário.
  const daSessao =
    sessionStoreId && (!activeStoreId || activeStoreId === sessionStoreId)
      ? sessionStoreName
      : null;

  return data ?? daSessao ?? DEFAULT_STORE_NAME;
}
