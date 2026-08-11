"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ShowcaseMedia, ShowcaseTab } from "@/types/domain";
import { listShowcaseMedia } from "@/lib/db/showcase-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useStoreContext } from "@/features/stores/store-context";

const ALL = "__all__";

/**
 * Estado da Vitrine para uma aba: lista viva (Realtime) já ordenada por data
 * decrescente pelo repositório, mais o filtro por coleção aplicado no cliente.
 * A lista é escopada pela loja ativa (própria loja, ou a selecionada pelo admin).
 */
export function useShowcase(tab: ShowcaseTab) {
  const { activeStoreId } = useStoreContext();
  useRealtimeInvalidation("showcase_media", queryKeys.showcase);

  const listQ = useQuery({
    queryKey: [...queryKeys.showcase, tab, activeStoreId],
    queryFn: () => listShowcaseMedia(tab, activeStoreId),
  });

  const [collection, setCollection] = useState<string>(ALL);

  const all = listQ.data ?? [];

  // Coleções disponíveis (para o seletor de filtro).
  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const m of all) if (m.collectionName) set.add(m.collectionName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [all]);

  // Aplica o filtro de coleção; a ordenação (recentes no topo) já vem do banco.
  const media: ShowcaseMedia[] = useMemo(() => {
    if (collection === ALL) return all;
    return all.filter((m) => m.collectionName === collection);
  }, [all, collection]);

  return {
    media,
    collections,
    collection,
    setCollection,
    allValue: ALL,
    loading: listQ.isPending,
  };
}
