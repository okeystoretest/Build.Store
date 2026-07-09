"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreName, DEFAULT_STORE_NAME } from "@/lib/db/settings-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/**
 * Nome da loja (global). Realtime na tabela `settings` propaga a alteração feita
 * na Gestão para todos os dispositivos — a sidebar atualiza sozinha.
 */
export function useStoreName(): string {
  useRealtimeInvalidation("settings", queryKeys.settings);
  const { data } = useQuery({
    queryKey: queryKeys.settings,
    queryFn: getStoreName,
  });
  return data ?? DEFAULT_STORE_NAME;
}
