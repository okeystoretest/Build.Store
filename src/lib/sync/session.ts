"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";

/**
 * Prontidão de sessão para sincronização.
 *
 * Arquitetura de loja única: NÃO há mais `store_id`. A sessão está "pronta"
 * assim que existe um usuário autenticado. O pull depende de RLS que libera
 * tudo para `authenticated`, então basta garantir que o cookie de sessão já
 * propagou antes de sincronizar — caso contrário os selects voltariam vazios
 * (sem erro) e um clear() cego poderia esvaziar o Dexie.
 */

export interface SessionInfo {
  userId: string;
}

/**
 * Retorna a sessão pronta (usuário autenticado) ou null se ainda não houver
 * sessão utilizável. Nunca lança: em qualquer falha devolve null para que o
 * chamador simplesmente adie o sync em vez de destruir dados locais.
 */
export async function getReadySession(): Promise<SessionInfo | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return null;
    return { userId: session.user.id };
  } catch (e) {
    console.error("[sync] getReadySession exceção:", e);
    return null;
  }
}

/**
 * Aguarda a sessão ficar pronta, tentando algumas vezes com pequeno intervalo.
 * Cobre a janela entre o login (redirect) e a propagação do cookie/refresh do
 * token. Devolve a sessão ou null se não ficar pronta a tempo.
 */
export async function waitForReadySession(
  attempts = 6,
  delayMs = 500,
): Promise<SessionInfo | null> {
  for (let i = 0; i < attempts; i += 1) {
    const session = await getReadySession();
    if (session) return session;
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}
