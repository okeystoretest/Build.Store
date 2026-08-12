"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreLogoAction } from "@/features/settings/actions/settings";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useStoreContext } from "@/features/stores/store-context";

/**
 * Logotipo da loja ATIVA. Segue a mesma resolução de loja do useStoreName.
 * Retorna null quando não há logo (ou admin em "todas as lojas").
 */
export function useStoreLogo(): string | null {
  const { activeStoreId } = useStoreContext();
  useRealtimeInvalidation("settings", ["settings"]);
  const { data } = useQuery({
    queryKey: ["settings", "logo", activeStoreId],
    queryFn: () => getStoreLogoAction(activeStoreId),
  });
  return data ?? null;
}
