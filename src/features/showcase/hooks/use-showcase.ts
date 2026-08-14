"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ShowcaseMedia, ShowcaseTab } from "@/types/domain";
import { listShowcaseMediaAction } from "@/features/showcase/actions/showcase";
import { sortMediaAlphanumeric } from "@/features/showcase/lib/showcase";
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
    queryFn: () => listShowcaseMediaAction(tab, activeStoreId),
  });

  const [collection, setCollection] = useState<string>(ALL);

  const all = listQ.data ?? [];

  // Coleções disponíveis (para o seletor de filtro).
  const collections = useMemo(() => {
    const set = new Set<string>();
    for (const m of all) if (m.collectionName) set.add(m.collectionName);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [all]);

  /**
   * Filtro de coleção + ordenação ALFANUMÉRICA pelo padrão de nomenclatura
   * (título; na falta dele, o nome do arquivo). Vale para as três abas.
   *
   * A ordenação é feita aqui, e não no `ORDER BY`, porque o Postgres ordena por
   * bytes: "Look 10" viria antes de "Look 2". O `Intl.Collator` com
   * `numeric: true` entende o número dentro do texto, que é o que a vitrine
   * numerada precisa.
   */
  const media: ShowcaseMedia[] = useMemo(() => {
    const base =
      collection === ALL
        ? all
        : all.filter((m) => m.collectionName === collection);
    return sortMediaAlphanumeric(base);
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
