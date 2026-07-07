import { db } from "@/lib/db/dexie";
import type {
  Order,
  OrderItem,
  CartItem,
  PaymentMethod,
} from "@/types/domain";
import { orderReference } from "@/lib/utils/reference";
import { computeTotals, changeCents } from "@/lib/utils/cart";

/**
 * Order repository. Recording a sale is the moment the two feature halves meet:
 * the order is written, stock is decremented per line, and stock movements are
 * logged — all inside one Dexie transaction so a crash can't leave stock and
 * sales out of sync. The order lands with syncStatus="pending" for the sync
 * engine to flush.
 */

export interface RecordSaleInput {
  items: CartItem[];
  globalDiscountCents: number;
  paymentMethod: PaymentMethod;
  tenderedCents: number | null;
  customerId?: string | null;
  customerName?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  campaignId?: string | null;
  createdBy?: string | null;
}

export async function recordSale(input: RecordSaleInput): Promise<Order> {
  const totals = computeTotals(input.items, input.globalDiscountCents);
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  const items: OrderItem[] = input.items.map((i) => ({
    ...i,
    id: crypto.randomUUID(),
    orderId,
  }));

  const order: Order = {
    id: orderId,
    reference: orderReference(),
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    items,
    subtotalCents: totals.subtotalCents,
    discountCents: totals.discountCents,
    totalCents: totals.totalCents,
    paymentMethod: input.paymentMethod,
    tenderedCents: input.tenderedCents,
    changeCents:
      input.paymentMethod === "cash" && input.tenderedCents != null
        ? changeCents(totals.totalCents, input.tenderedCents)
        : null,
    status: "completed",
    syncStatus: "pending",
    sellerId: input.sellerId ?? null,
    sellerName: input.sellerName ?? null,
    campaignId: input.campaignId ?? null,
    createdAt: now,
    createdBy: input.createdBy ?? null,
  };

  await db.transaction(
    "rw",
    db.orders,
    db.products,
    db.stockMovements,
    async () => {
      await db.orders.put(order);

      for (const item of input.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            stock: product.stock - item.quantity,
            updatedAt: now,
          });
        }
        await db.stockMovements.put({
          id: crypto.randomUUID(),
          productId: item.productId,
          delta: -item.quantity,
          reason: "sale",
          orderId,
          note: null,
          createdAt: now,
        });
      }
    },
  );

  return order;
}

export async function listOrders(): Promise<Order[]> {
  return db.orders.orderBy("createdAt").reverse().toArray();
}

/** Reverse a completed sale: restock items and flag the order refunded. */
export async function refundOrder(orderId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction(
    "rw",
    db.orders,
    db.products,
    db.stockMovements,
    async () => {
      const order = await db.orders.get(orderId);
      if (!order || order.status === "refunded") return;

      for (const item of order.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            stock: product.stock + item.quantity,
            updatedAt: now,
          });
        }
        await db.stockMovements.put({
          id: crypto.randomUUID(),
          productId: item.productId,
          delta: item.quantity,
          reason: "return",
          orderId,
          note: "Estorno",
          createdAt: now,
        });
      }

      await db.orders.update(orderId, {
        status: "refunded",
        syncStatus: "pending",
      });
    },
  );
}
