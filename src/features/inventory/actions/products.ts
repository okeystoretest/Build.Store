"use server";

import { sql } from "kysely";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toProduct, productToRow } from "@/lib/db/mappers";
import type { Product, StockMovement } from "@/types/domain";

/**
 * Server Actions de Produtos — Kysely + RLS por sessão. A RLS (0004) isola por
 * loja; o filtro storeId abaixo é o narrowing do admin (quando há loja ativa).
 */

export async function listProductsAction(
  storeId?: string | null,
): Promise<Product[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("products").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("name", "asc").execute();
    return rows.map((r) => toProduct(r as Record<string, unknown>));
  });
}

export async function getProductAction(
  id: string,
): Promise<Product | undefined> {
  return withCurrentUser(async (trx) => {
    const row = await trx
      .selectFrom("products")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? toProduct(row as Record<string, unknown>) : undefined;
  });
}

/** Upsert idempotente pelo id (cria ou atualiza). */
export async function upsertProductAction(
  product: Product,
  storeId: string,
): Promise<void> {
  const row = productToRow({ ...product, updatedAt: new Date().toISOString() });
  // grade é jsonb — serializa para o driver.
  const values = {
    ...row,
    grade: sql`${JSON.stringify(row.grade ?? [])}::jsonb`,
    store_id: storeId,
  };

  await withCurrentUser(async (trx) => {
    await trx
      .insertInto("products")
      .values(values as never)
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          sku: row.sku as string,
          barcode: row.barcode as string | null,
          name: row.name as string,
          description: row.description as string | null,
          category: row.category as string | null,
          cost_cents: row.cost_cents as number,
          price_cents: row.price_cents as number,
          unit: row.unit as string,
          stock: row.stock as number,
          low_stock_threshold: row.low_stock_threshold as number,
          color: row.color as string | null,
          size: row.size as string | null,
          grade: sql`${JSON.stringify(row.grade ?? [])}::jsonb`,
          address: row.address as string | null,
          image_url: row.image_url as string | null,
          active: row.active as boolean,
          updated_at: row.updated_at as string,
          store_id: storeId,
        }),
      )
      .execute();
  });
}

/** Remove um produto (somente Admin — controlado na UI e pela RLS). */
export async function deleteProductAction(id: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("products").where("id", "=", id).execute();
  });
}

/**
 * Registra um movimento de estoque. O gatilho do banco aplica o delta em
 * products.stock. Ajustes manuais de inventário. Vendas registram seus próprios
 * movimentos dentro de recordSale.
 */
export async function applyStockMovementAction(
  movement: Omit<StockMovement, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
  storeId: string,
): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx
      .insertInto("stock_movements")
      .values({
        product_id: movement.productId,
        delta: movement.delta,
        reason: movement.reason,
        order_id: movement.orderId ?? null,
        note: movement.note ?? null,
        store_id: storeId,
      } as never)
      .execute();
  });
}
