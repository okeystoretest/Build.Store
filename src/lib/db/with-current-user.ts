import "server-only";
import { Kysely } from "kysely";
import { db, withUser } from "@/lib/db/kysely";
import { getCurrentSession } from "@/lib/auth/session";
import type { Database } from "@/lib/db/schema";

/**
 * Resolve o usuário logado (sessão Lucia) e executa `fn` DENTRO de withUser,
 * para a RLS por loja enxergar a identidade. É o wrapper padrão das Server
 * Actions de dados: garante que nenhuma query escapa sem identidade.
 *
 * Lança se não houver sessão — as Actions de dados exigem usuário autenticado
 * (o middleware já barra rotas, isto é a segunda linha de defesa).
 */
export async function withCurrentUser<T>(
  fn: (trx: Kysely<Database>, user: { id: string; role: string; storeId: string | null }) => Promise<T>,
): Promise<T> {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Não autenticado.");
  return withUser(user.id, (trx) =>
    fn(trx, { id: user.id, role: user.role, storeId: user.storeId ?? null }),
  );
}

/** Acesso ao Kysely global sem escopo de usuário (uso restrito: pré-sessão). */
export { db };
