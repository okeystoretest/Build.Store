import { db } from "@/lib/db/dexie";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { transport } from "@/lib/sync/transport";
import type { Product, StockMovement } from "@/types/domain";

/**
 * Product repository. Dexie is the local source of truth; the sync transport
 * (below) reconciles it with Supabase. Features talk to this module, never to
 * Dexie or the network directly — so swapping the backend is a one-file change.
 */

/**
 * IDs dos pedidos de demonstração que existiam em versões anteriores. Mantidos
 * apenas para PURGAR do IndexedDB de quem já os tinha gravado — nunca mais são
 * inseridos.
 */
const LEGACY_DEMO_ORDER_IDS = [
  "demo-8842",
  "demo-8841",
  "demo-8840",
  "demo-8839",
  "demo-8838",
  "demo-8837",
];

/**
 * Executa a inicialização local e remove QUALQUER dado de demonstração legado.
 *
 * Os dados de demonstração foram removidos permanentemente do app. Esta função
 * não injeta mais nada — apenas limpa resíduos de demos que possam ter ficado
 * gravados no IndexedDB de sessões antigas (pedidos, movimentos de estoque e
 * o contador de sequência associado). Assim, ao logar, as abas de pedidos,
 * dashboard e relatórios ficam limpas sem precisar apagar o storage à mão.
 */
export async function ensureSeeded(): Promise<void> {
  await purgeLegacyDemoData();
}

/** Remove pedidos/movimentos de demonstração remanescentes de versões antigas. */
async function purgeLegacyDemoData(): Promise<void> {
  const demoOrders = await db.orders
    .where("id")
    .anyOf(LEGACY_DEMO_ORDER_IDS)
    .toArray();

  if (demoOrders.length > 0) {
    await db.orders.bulkDelete(demoOrders.map((o) => o.id));
    // Remove os movimentos de estoque atrelados a esses pedidos.
    const moves = await db.stockMovements
      .where("orderId")
      .anyOf(LEGACY_DEMO_ORDER_IDS)
      .toArray();
    if (moves.length > 0) {
      await db.stockMovements.bulkDelete(moves.map((m) => m.id));
    }
    // Zera o contador de referência de pedidos herdado do seed de demonstração.
    await db.counters.delete("orderSeq");
  }
}

export async function listProducts(): Promise<Product[]> {
  return db.products.orderBy("name").toArray();
}

export async function getProduct(id: string): Promise<Product | undefined> {
  return db.products.get(id);
}

export async function upsertProduct(product: Product): Promise<void> {
  const saved = { ...product, updatedAt: new Date().toISOString() };
  await db.products.put(saved);

  // Best-effort: quando há backend e conexão, envia o produto ao Supabase.
  // O Dexie continua sendo a fonte local; se o push falhar (offline/erro), o
  // pull de produtos reconcilia depois — não bloqueia a operação do usuário.
  if (isSupabaseConfigured() && (typeof navigator === "undefined" || navigator.onLine)) {
    try {
      await transport.pushProduct(saved);
    } catch {
      /* silencioso: reconciliação posterior via pullProducts */
    }
  }
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