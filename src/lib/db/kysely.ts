import "server-only";
import { Pool } from "pg";
import { Kysely, PostgresDialect, sql } from "kysely";
import type { Database } from "@/lib/db/schema";

/**
 * Conexão Postgres (VPS) + Kysely. Substitui o cliente Supabase na camada de
 * dados. Só server-side ("server-only") — o cliente nunca fala com o banco
 * direto; passa por Server Actions / Route Handlers.
 *
 * Um único Pool por processo (reaproveitado entre requests). A connection
 * string vem de DATABASE_URL.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!global.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não configurada.");
    }
    global.__pgPool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 10),
    });
  }
  return global.__pgPool;
}

/** Instância Kysely global (lazy — só conecta no primeiro uso, não no build). */
let _db: Kysely<Database> | undefined;

export function getDb(): Kysely<Database> {
  if (!_db) {
    _db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: getPool() }),
    });
  }
  return _db;
}

/**
 * Proxy que resolve para a instância real no primeiro acesso. Mantém a API
 * `db.selectFrom(...)` nos chamadores sem construir o Pool no import (o build do
 * Next coleta dados das rotas sem DATABASE_URL, e a construção ansiosa quebrava).
 */
export const db: Kysely<Database> = new Proxy({} as Kysely<Database>, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/**
 * Executa `fn` com a identidade do usuário aplicada à SESSÃO do Postgres, para
 * a RLS funcionar sem `auth.uid()` do Supabase.
 *
 * Como funciona: abre uma transação, faz `SET LOCAL app.current_user_id = <id>`
 * (válido só naquela transação/conexão), e roda a query. As funções
 * is_admin()/current_store_id() (migração 0005) leem
 * current_setting('app.current_user_id'), então a RLS enxerga o usuário certo.
 *
 * SET LOCAL garante que a identidade não vaza para outra requisição que
 * reutilize a mesma conexão do pool — expira ao fim da transação.
 *
 * Toda leitura/escrita escopada por loja DEVE passar por aqui. Consultas fora
 * de withUser rodam sem identidade (a RLS bloqueia dados de loja) — use apenas
 * para operações públicas/sistêmicas (ex.: validar login antes de haver sessão).
 */
export async function withUser<T>(
  userId: string,
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    // set_config(name, value, is_local=true) = SET LOCAL; parametrizável.
    await sql`select set_config('app.current_user_id', ${userId}, true)`.execute(
      trx,
    );
    return fn(trx);
  });
}
