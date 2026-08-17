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

/**
 * 30s (era 8s). Cada tick invalida a chave e dispara uma Server Action — que é
 * um POST ao servidor, com validação de sessão no Postgres. Com o mesmo hook
 * montado em várias telas ao mesmo tempo (nome e logotipo da loja aparecem na
 * sidebar E na barra de topo), 8 segundos significavam dezenas de round-trips
 * por minuto para dados que mudam uma vez por semana. Mutação continua
 * invalidando na hora — o polling só cobre alteração feita em OUTRO
 * dispositivo, onde poucos segundos a mais não fazem diferença.
 */
const POLL_INTERVAL_MS = Number(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? 30000,
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
      if (document.visibilityState !== "visible") return;
      // `refetchType: "active"`: revalida só o que está montado na tela. Sem
      // isto, a invalidação marcava como velhas também as queries de telas já
      // desmontadas, que iam refazer a busca na próxima visita mesmo com dado
      // fresco no cache.
      void queryClient.invalidateQueries({ queryKey, refetchType: "active" });
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
