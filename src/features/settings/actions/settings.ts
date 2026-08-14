"use server";

import { sql } from "kysely";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { getCurrentSession } from "@/lib/auth/session";
import { DEFAULT_STORE_NAME } from "@/features/settings/constants";
import {
  LOCKABLE_ROLES,
  TOOL_ACCESS_KEY,
  TOOL_BY_KEY,
  parseToolAccess,
  type LockableRole,
  type RoleAccess,
  type ToolAccess,
  type ToolKey,
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

/**
 * Nome da loja ativa.
 *
 * Cai para `stores.name` quando não há nome em `settings`. Sem isso, uma loja
 * recém-cadastrada em Lojas aparecia na sidebar como "Build.Sales": o cadastro
 * grava `stores.name`, e a chave de settings só nascia se alguém abrisse a
 * antiga aba Gestão › Loja — que deixou de existir.
 */
export async function getStoreNameAction(
  storeId: string | null,
): Promise<string> {
  const v = await getValue(storeId, STORE_NAME_KEY);
  if (v && v.trim()) return v.trim();
  if (!storeId) return DEFAULT_STORE_NAME;

  const doCadastro = await withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("stores")
      .select("name")
      .where("id", "=", storeId)
      .executeTakeFirst();
    return (row?.name as string | null) ?? null;
  });

  return (doCadastro ?? "").trim() || DEFAULT_STORE_NAME;
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
 * A foto passou a ser cadastrada só em Lojas (a aba Gestão › Loja foi
 * removida), e o cadastro grava nos dois lugares. O fallback para
 * `stores.logo_url` continua aqui para as lojas antigas, cadastradas antes
 * dessa unificação. Seja qual for a origem, a mesma imagem aparece como foto de
 * perfil de todos os usuários daquela loja.
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
 * Grava o cadeado de uma ferramenta na loja, por papel.
 *
 * `papeis` traz o estado escolhido no modal para cada perfil editável
 * (`true` = liberado, `false` = bloqueado). Papel omitido fica como estava.
 *
 * Só admin: a checagem é explícita aqui porque a tabela `settings` é gravável
 * por lojista (nome e logo da loja passam por ela), e sem esta trava um lojista
 * poderia liberar telas para as próprias vendedoras.
 */
export async function setToolAccessAction(
  storeId: string,
  tool: ToolKey,
  papeis: RoleAccess,
): Promise<ToolAccess> {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Não autenticado.");
  if (user.role !== "admin") {
    throw new Error("Apenas administradores podem alterar o acesso.");
  }
  const meta = TOOL_BY_KEY[tool];
  if (!meta) throw new Error("Ferramenta desconhecida.");

  const atual = await getToolAccessAction(storeId);
  const doTool: RoleAccess = { ...(atual[tool] ?? {}) };

  for (const papel of LOCKABLE_ROLES) {
    const v = papeis[papel as LockableRole];
    if (v === undefined) continue;
    // Liberar o que a ferramenta não permite liberar é ignorado em silêncio no
    // resolvedor; recusar aqui deixa o erro visível para quem tentou.
    if (v === true && !meta.unlockable) {
      throw new Error(
        `${meta.label} não pode ser liberada para ${papel}: a tela exclui a loja inteira.`,
      );
    }
    doTool[papel] = v;
  }

  const novo: ToolAccess = { ...atual, [tool]: doTool };
  await upsertValue(storeId, TOOL_ACCESS_KEY, JSON.stringify(novo));
  return novo;
}
