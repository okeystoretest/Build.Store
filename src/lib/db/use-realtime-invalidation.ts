"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Atualização "ao vivo" por POLLING (sem Supabase).
 *
 * Substitui o antigo realtime do Supabase mantendo a MESMA assinatura
 * (table, queryKey), então nenhum hook chamador muda. Em vez de assinar
 * postgres_changes, revalida a queryKey em intervalo fixo — simples, sem
 * serviço extra, e adequado à operação (5 lojas). O atraso é de poucos
 * segundos; se algum dia precisar de tempo real de verdade, dá para evoluir
 * para SSE/WebSocket com LISTEN/NOTIFY do Postgres sem mexer nos chamadores.
 *
 * O parâmetro `table` é mantido só por compatibilidade de assinatura (não é
 * mais usado); o polling age sobre a queryKey.
 */

const POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 8000,
);

export function useRealtimeInvalidation(
  _table: string,
  queryKey: readonly unknown[],
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Revalida periodicamente enquanto a aba está visível. Ao voltar o foco,
    // revalida na hora (pega mudanças feitas em outro dispositivo).
    const tick = () => {
      if (document.visibilityState === "visible") {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    const id = setInterval(tick, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // queryKey vem de constantes estáveis (query-keys) + storeId; o array muda
    // quando a loja ativa muda, reiniciando o polling no escopo novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queryKey)]);
}
