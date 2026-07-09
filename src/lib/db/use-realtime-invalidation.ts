"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/**
 * Assina o Realtime do Supabase para uma tabela e invalida a query key
 * correspondente quando QUALQUER mudança (insert/update/delete) chega — de
 * qualquer dispositivo. É o que substitui o antigo useLiveQuery do Dexie: as
 * telas convergem ao vivo entre aparelhos sem polling.
 *
 * Uma inscrição por tabela consumida. O canal é removido no unmount.
 */
export function useRealtimeInvalidation(
  table: string,
  queryKey: readonly unknown[],
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime:${table}`)
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
