"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreName, DEFAULT_STORE_NAME } from "@/lib/db/settings-repository";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useStoreContext } from "@/features/stores/store-context";

/**
 * Nome da loja ATIVA. Para lojista/vendedora é a própria loja; para admin é a
 * loja selecionada no seletor global (ou o padrão quando em "todas as lojas").
 * Realtime na tabela `settings` propaga alterações para todos os dispositivos.
 */
export function useStoreName(): string {
  const { activeStoreId } = useStoreContext();
  useRealtimeInvalidation("settings", ["settings"]);
  const { data } = useQuery({
    queryKey: ["settings", "name", activeStoreId],
    queryFn: () => getStoreName(activeStoreId),
  });
  return data ?? DEFAULT_STORE_NAME;
}
