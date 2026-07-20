"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreLogo } from "@/lib/db/settings-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/**
 * Logotipo da loja (global). Realtime na tabela `settings` propaga a alteração
 * feita na Gestão para todos os dispositivos. Retorna null quando não há logo.
 */
export function useStoreLogo(): string | null {
  useRealtimeInvalidation("settings", queryKeys.settings);
  const { data } = useQuery({
    queryKey: [...queryKeys.settings, "logo"],
    queryFn: getStoreLogo,
  });
  return data ?? null;
}
