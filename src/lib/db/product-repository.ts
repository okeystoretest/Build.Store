import { db } from "@/lib/db/dexie";
import { SEED_PRODUCTS } from "@/lib/db/seed";
import { DEMO_ORDERS } from "@/lib/db/demo-orders";
import { SEED_USERS, SEED_CAMPAIGNS, SEED_GOALS } from "@/lib/db/management-seed";
import type { Product, StockMovement } from "@/types/domain";

/**
 * Product repository. Dexie is the local source of truth; the sync transport
 * (below) reconciles it with Supabase. Features talk to this module, never to
 * Dexie or the network directly — so swapping the backend is a one-file change.
 */

/** Populate the local store once, on first run. Idempotent. */
export async function ensureSeeded(): Promise<void> {
  const productCount = await db.products.count();
  if (productCount === 0) {
    await db.products.bulkPut(SEED_PRODUCTS);
  }
  const orderCount = await db.orders.count();
  if (orderCount === 0) {
    await db.orders.bulkPut(DEMO_ORDERS);
    // Continua a numeração sequencial (#PDD-XXX) após os pedidos de demonstração.
    await db.counters.put({ id: "orderSeq", value: DEMO_ORDERS.length });
  }
  const userCount = await db.users.count();
  if (userCount === 0) {
    await db.users.bulkPut(SEED_USERS);
    await db.campaigns.bulkPut(SEED_CAMPAIGNS);
    await db.goals.bulkPut(SEED_GOALS);
  }
}

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy("name").toArray();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function upsertProduct(product: Product): Promise<void> {
  await db.products.put({ ...product, updatedAt: new Date().toISOString() });
}

/** Remove um produto do estoque (somente Admin, controlado na UI). */
export async function deleteProduct(id: string): Promise<void> {
  await db.products.delete(id);
}

/**
 * Apply a stock delta atomically and record the movement. Used by the sale
 * flow (negative deltas) and manual inventory adjustments. Returns the new
 * stock level so callers can react (e.g. low-stock alerts).
 */
export async function applyStockMovement(
  movement: Omit<StockMovement, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<number> {
  return db.transaction("rw", db.products, db.stockMovements, async () => {
    const product = await db.products.get(movement.productId);
    if (!product) throw new Error(`Produto ${movement.productId} não encontrado`);

    const nextStock = product.stock + movement.delta;
    await db.products.update(movement.productId, {
      stock: nextStock,
      updatedAt: new Date().toISOString(),
    });

    await db.stockMovements.put({
      id: movement.id ?? crypto.randomUUID(),
      productId: movement.productId,
      delta: movement.delta,
      reason: movement.reason,
      orderId: movement.orderId ?? null,
      note: movement.note ?? null,
      createdAt: movement.createdAt ?? new Date().toISOString(),
    });

    return nextStock;
  });
}
