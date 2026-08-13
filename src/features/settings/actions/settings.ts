"use server";

import { sql } from "kysely";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { getCurrentSession } from "@/lib/auth/session";
import { DEFAULT_STORE_NAME } from "@/features/settings/constants";
import {
  TOOL_ACCESS_KEY,
  parseToolAccess,
  type ToolAccess,
  type UnlockableTool,
} from "@/features/settings/tool-access";

/**
 * Server Actions de configurações da loja (tabela `settings`, key/value por
 * loja, PK composta (key, store_id)). Kysely + RLS por sessão.
 */

const STORE_NAME_KEY = "store_name";
const STORE_LOGO_KEY = "store_logo";

async function getValue(
  storeId: string | null,
  key: string,
): Promise<string | null> {
  if (!storeId) return null;
  return withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("settings")
      .select("value")
      .where("key", "=", key)
      .where("store_id", "=", storeId)
      .executeTakeFirst();
    return (row?.value as string | null) ?? null;
  });
}

async function upsertValue(
  storeId: string,
  key: string,
  value: string,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx
      .insertInto("settings")
      .values({
        key,
        store_id: storeId,
        value,
        updated_at: new Date().toISOString(),
      })
      .onConflict((oc) =>
        oc.columns(["key", "store_id"]).doUpdateSet({
          value,
          updated_at: sql`now()`,
        }),
      )
      .execute();
  });
}

export async function getStoreNameAction(
  storeId: string | null,
): Promise<string> {
  const v = await getValue(storeId, STORE_NAME_KEY);
  return (v ?? "").trim() || DEFAULT_STORE_NAME;
}

export async function setStoreNameAction(
  storeId: string,
  name: string,
): Promise<void> {
  await upsertValue(storeId, STORE_NAME_KEY, name.trim() || DEFAULT_STORE_NAME);
}

/**
 * Logotipo/foto da loja ativa.
 *
 * Cai para `stores.logo_url` quando não há logotipo definido em Gestão: são
 * dois pontos de cadastro para a mesma coisa (Gestão › Dados da loja e a foto
 * da loja em Lojas), e a lojista não deveria precisar saber a diferença. Assim,
 * seja qual for o lugar em que a foto foi enviada, ela aparece no perfil da
 * sidebar de todos os usuários daquela loja.
 */
export async function getStoreLogoAction(
  storeId: string | null,
): Promise<string | null> {
  const v = await getValue(storeId, STORE_LOGO_KEY);
  if (v && v.trim()) return v;
  if (!storeId) return null;

  return withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("stores")
      .select("logo_url")
      .where("id", "=", storeId)
      .executeTakeFirst();
    const url = (row?.logo_url as string | null) ?? null;
    return url && url.trim() ? url : null;
  });
}

export async function setStoreLogoAction(
  storeId: string,
  url: string | null,
): Promise<void> {
  await upsertValue(storeId, STORE_LOGO_KEY, url ?? "");
}

// --- Liberação de ferramentas (cadeado da sidebar) --------------------------

/**
 * Ferramentas liberadas para a loja. Leitura aberta a qualquer usuário
 * autenticado da loja — a sidebar precisa disso para decidir o que mostrar.
 */
export async function getToolAccessAction(
  storeId: string | null,
): Promise<ToolAccess> {
  const raw = await getValue(storeId, TOOL_ACCESS_KEY);
  return parseToolAccess(raw);
}

/**
 * Grava a liberação. Só admin — a checagem é explícita aqui porque a tabela
 * `settings` é gravável por lojista (nome e logo da loja passam por ela), e sem
 * esta trava um lojista poderia liberar telas para as próprias vendedoras.
 */
export async function setToolAccessAction(
  storeId: string,
  tool: UnlockableTool,
  enabled: boolean,
): Promise<ToolAccess> {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Não autenticado.");
  if (user.role !== "admin") {
    throw new Error("Apenas administradores podem liberar ferramentas.");
  }

  const atual = await getToolAccessAction(storeId);
  const novo: ToolAccess = { ...atual, [tool]: enabled };
  await upsertValue(storeId, TOOL_ACCESS_KEY, JSON.stringify(novo));
  return novo;
}
