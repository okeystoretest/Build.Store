"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Assina o Realtime do Supabase para uma tabela e invalida a query key
 * correspondente quando QUALQUER mudança (insert/update/delete) chega — de
 * qualquer dispositivo. Substitui o antigo useLiveQuery do Dexie: as telas
 * convergem ao vivo entre aparelhos sem polling.
 *
 * IMPORTANTE: cada assinatura recebe um nome de canal ÚNICO. Se dois
 * componentes montados ao mesmo tempo assinam a mesma tabela (ex.: sidebar e
 * Gestão ambas ouvindo `settings`, ou vários hooks ouvindo `profiles`), usar um
 * nome fixo por tabela faz o Supabase recusar o segundo com
 * "cannot add postgres_changes callbacks ... after subscribe()". O id aleatório
 * por montagem evita a colisão.
 */
export function useRealtimeInvalidation(
  table: string,
  queryKey: readonly unknown[],
): void {
  const queryClient = useQueryClient();
  // Nome de canal único e estável durante o ciclo de vida deste hook.
  const channelName = useRef(
    `realtime:${table}:${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(channelName.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // queryKey é estável (constante do módulo query-keys); table é string fixa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
}
