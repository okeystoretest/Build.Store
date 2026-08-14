"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toStore } from "@/lib/db/mappers";
import {
  setStoreLogoAction,
  setStoreNameAction,
} from "@/features/settings/actions/settings";
import type { Store } from "@/types/domain";

/**
 * Server Actions de Lojas (tenants) — Kysely + RLS por sessão.
 * A RLS (0004) garante que só admin escreve; a leitura é liberada a autenticados.
 * Exclusão é HARD-DELETE (cascade apaga todos os dados da loja).
 *
 * Esta é a ÚNICA porta de cadastro de nome e foto da loja: a antiga aba
 * Gestão › Loja foi removida. Para o resto do app continuar enxergando os dois
 * dados pelo mesmo caminho de sempre (`settings`, que alimenta a sidebar, o
 * comprovante impresso e o perfil dos usuários), toda escrita aqui espelha o
 * valor em `settings` — em vez de espalhar um segundo caminho de leitura por
 * dez telas.
 */

/**
 * Propaga a foto da loja para o perfil de todos os usuários vinculados a ela.
 *
 * A foto da loja É a foto de perfil da equipe (requisito 2.C): o app não tem
 * upload de avatar individual, então não há foto pessoal para atropelar.
 */
async function propagarFotoParaUsuarios(
  storeId: string,
  logoUrl: string | null,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx
      .updateTable("profiles")
      .set({ photo_url: logoUrl })
      .where("store_id", "=", storeId)
      .execute();
  });
}

/** Espelha nome/foto em `settings` e no perfil da equipe. */
async function espelharCadastro(
  storeId: string,
  patch: { name?: string; logoUrl?: string | null },
): Promise<void> {
  if (patch.name !== undefined && patch.name.trim()) {
    await setStoreNameAction(storeId, patch.name.trim());
  }
  if (patch.logoUrl !== undefined) {
    await setStoreLogoAction(storeId, patch.logoUrl);
    await propagarFotoParaUsuarios(storeId, patch.logoUrl);
  }
}

export async function listStoresAction(): Promise<Store[]> {
  return withCurrentUser(async (trx) => {
    const rows = await trx
      .selectFrom("stores")
      .selectAll()
      .orderBy("created_at", "asc")
      .execute();
    return rows.map((r) => toStore(r as Record<string, unknown>));
  });
}

export async function createStoreAction(input: {
  name: string;
  logoUrl?: string | null;
}): Promise<Store> {
  const store = await withCurrentUser(async (trx) => {
    const row = await trx
      .insertInto("stores")
      .values({
        id: randomUUID(),
        name: input.name,
        logo_url: input.logoUrl ?? null,
        active: true,
        created_at: new Date().toISOString(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toStore(row as Record<string, unknown>);
  });

  // Sem isto, a loja recém-criada aparecia na sidebar como "Build.Sales" até
  // alguém salvar o nome de novo em outra tela.
  await espelharCadastro(store.id, {
    name: store.name,
    logoUrl: store.logoUrl ?? null,
  });

  return store;
}

export async function updateStoreAction(
  id: string,
  patch: Partial<Pick<Store, "name" | "logoUrl" | "active">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return;

  await withCurrentUser(async (trx) => {
    await trx.updateTable("stores").set(row).where("id", "=", id).execute();
  });

  await espelharCadastro(id, {
    name: patch.name,
    logoUrl: patch.logoUrl,
  });
}

export async function deleteStoreAction(id: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("stores").where("id", "=", id).execute();
  });
}

/**
 * Foto da loja, para herdar no perfil de um usuário novo. Lê o cadastro da
 * loja, que é a fonte de verdade da imagem desde a unificação.
 */
export async function getStorePhotoAction(
  storeId: string,
): Promise<string | null> {
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
