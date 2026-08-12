"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toNotification } from "@/lib/db/mappers";
import type { AppNotification, Product } from "@/types/domain";

/**
 * Server Actions do sino de notificações — Kysely + RLS por sessão. Escopo por
 * loja: `storeId` filtra (narrowing do admin); a RLS já restringe não-admins.
 */

export async function listNotificationsAction(
  storeId?: string | null,
): Promise<AppNotification[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("notifications").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("created_at", "desc").execute();
    return rows.map((r) => toNotification(r as Record<string, unknown>));
  });
}

export async function markAllReadAction(
  storeId?: string | null,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    let q = trx
      .updateTable("notifications")
      .set({ read: true })
      .where("read", "=", false);
    if (storeId) q = q.where("store_id", "=", storeId);
    await q.execute();
  });
}

export async function clearNotificationsAction(
  storeId?: string | null,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    let q = trx.deleteFrom("notifications");
    if (storeId) q = q.where("store_id", "=", storeId);
    await q.execute();
  });
}

export async function notifyProductAddedAction(
  product: Product,
  storeId: string,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx
      .insertInto("notifications")
      .values({
        id: randomUUID(),
        kind: "product_added",
        title: "Novo produto no estoque",
        body: `Ref. ${product.sku} · ${product.name} · ${product.stock} un`,
        read: false,
        store_id: storeId,
        created_at: new Date().toISOString(),
      } as never)
      .execute();
  });
}
