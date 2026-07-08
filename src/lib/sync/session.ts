"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";

/**
 * Prontidão de sessão para sincronização.
 *
 * O pull do servidor depende de RLS (current_store_id() → auth.uid()). Se ele
 * roda ANTES do cookie de sessão propagar — como acontecia logo após o
 * redirect do login — os selects voltam vazios SEM erro, e o engine acabava
 * limpando o Dexie com nada. Este helper garante que só sincronizamos quando
 * há uma sessão válida COM store_id resolvível.
 */

export interface SessionInfo {
  userId: string;
  storeId: string;
}

/**
 * Retorna a sessão pronta (usuário + store_id) ou null se ainda não houver
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("store_id")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile?.store_id) return null;
    return { userId: session.user.id, storeId: profile.store_id as string };
  } catch {
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
