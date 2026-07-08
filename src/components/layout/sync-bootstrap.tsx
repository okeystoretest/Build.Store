"use client";

import { useEffect, useRef } from "react";
import { flushPending, pullAll, isOnline } from "@/lib/sync/sync-engine";
import { waitForReadySession } from "@/lib/sync/session";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { createClient } from "@/lib/supabase/client";

/**
 * Sincroniza o app com o backend ao carregar, quando a conexão volta, quando a
 * sessão de auth muda (login) e quando a aba volta ao primeiro plano.
 *
 * Ordem importa: primeiro EMPURRA vendas locais pendentes (para não perder o
 * que foi feito offline), depois BAIXA o estado do servidor para o Dexie. Assim
 * qualquer dispositivo passa a enxergar o mesmo estoque, pedidos, usuários,
 * campanhas e metas. Em modo local puro (sem Supabase) as funções são no-ops.
 *
 * IMPORTANTE (correção de persistência): antes do pull, aguardamos a sessão
 * ficar pronta (waitForReadySession). Isso evita o pull "sem sessão" logo após
 * o redirect do login, que voltava vazio e limpava o Dexie — causa de dados
 * sumindo em outro dispositivo ou após Ctrl+F5.
 *
 * Não renderiza nada — é só um efeito montado no layout autenticado.
 */
export function SyncBootstrap() {
  const running = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (running.current || !isOnline()) return;
      running.current = true;
      try {
        // 1) Sobe o que foi criado offline (idempotente por pedido).
        await flushPending();
        // 2) Espera a sessão propagar e traz o estado autoritativo do servidor.
        //    Em modo local puro, waitForReadySession retorna null e pullAll é
        //    um no-op — sem espera desnecessária.
        if (isSupabaseConfigured()) {
          await waitForReadySession();
        }
        await pullAll();
      } catch (e) {
        console.error("[SyncBootstrap] Falha ao sincronizar:", e);
      } finally {
        running.current = false;
      }
    };

    void sync();

    // Reconexão de rede.
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);

    // Volta ao primeiro plano: re-puxa para convergir com outros dispositivos.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Mudança de sessão (ex.: login concluído neste dispositivo) dispara o
    // primeiro pull válido assim que o token/cookie está disponível.
    let unsubscribe: (() => void) | undefined;
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          void sync();
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe?.();
    };
  }, []);

  return null;
}
