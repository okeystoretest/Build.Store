"use client";

import { useEffect, useRef } from "react";
import { flushPending, pullAll, isOnline } from "@/lib/sync/sync-engine";

/**
 * Sincroniza o app com o backend ao carregar e quando a conexão volta.
 *
 * Ordem importa: primeiro EMPURRA vendas locais pendentes (para não perder o
 * que foi feito offline), depois BAIXA o estado do servidor para o Dexie. Assim
 * qualquer dispositivo passa a enxergar o mesmo estoque, pedidos, usuários,
 * campanhas e metas. Em modo local puro (sem Supabase) as funções são no-ops.
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
        // 1) Sobe o que foi criado offline.
        await flushPending();
        // 2) Traz o estado autoritativo do servidor.
        await pullAll();
      } catch (e) {
        console.error("[SyncBootstrap] Falha ao sincronizar:", e);
      } finally {
        running.current = false;
      }
    };

    void sync();

    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
