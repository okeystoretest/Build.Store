"use server";

import { sql } from "kysely";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { DEFAULT_STORE_NAME } from "@/features/settings/constants";

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

export async function getStoreLogoAction(
  storeId: string | null,
): Promise<string | null> {
  const v = await getValue(storeId, STORE_LOGO_KEY);
  return v && v.trim() ? v : null;
}

export async function setStoreLogoAction(
  storeId: string,
  dataUrl: string | null,
): Promise<void> {
  await upsertValue(storeId, STORE_LOGO_KEY, dataUrl ?? "");
}
