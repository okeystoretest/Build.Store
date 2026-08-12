"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toStore } from "@/lib/db/mappers";
import type { Store } from "@/types/domain";

/**
 * Server Actions de Lojas (tenants) — Kysely + RLS por sessão.
 * A RLS (0004) garante que só admin escreve; a leitura é liberada a autenticados.
 * Exclusão é HARD-DELETE (cascade apaga todos os dados da loja).
 */

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
  return withCurrentUser(async (trx) => {
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
}

export async function deleteStoreAction(id: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("stores").where("id", "=", id).execute();
  });
}
