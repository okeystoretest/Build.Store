import type { Order, OrderStatus, PaymentMethod } from "@/types/domain";

/**
 * Analytics aggregations. Pure functions over the order list so they're trivial
 * to test and reuse between the dashboard and the cash-closing report. Money
 * stays in centavos throughout.
 */

export interface SalesSummary {
  revenueCents: number;
  orderCount: number;
  itemsSold: number;
  averageTicketCents: number;
  refundRate: number; // 0..1
}

/** Only completed orders count toward revenue. */
function isRevenue(o: Order): boolean {
  return o.status === "completed";
}

export function salesSummary(orders: Order[]): SalesSummary {
  const completed = orders.filter(isRevenue);
  const revenueCents = completed.reduce((s, o) => s + o.totalCents, 0);
  const itemsSold = completed.reduce(
    (s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0),
    0,
  );
  const orderCount = completed.length;
  const refunded = orders.filter((o) => o.status === "refunded").length;
  const denom = orderCount + refunded;

  return {
    revenueCents,
    orderCount,
    itemsSold,
    averageTicketCents: orderCount ? Math.round(revenueCents / orderCount) : 0,
    refundRate: denom ? refunded / denom : 0,
  };
}

export interface ProductRank {
  productId: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  unitsSold: number;
  revenueCents: number;
}

/** Top products by units sold, across completed orders. */
export function topProducts(orders: Order[], limit = 5): ProductRank[] {
  const map = new Map<string, ProductRank>();
  for (const o of orders.filter(isRevenue)) {
    for (const i of o.items) {
      const entry =
        map.get(i.productId) ??
        {
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          imageUrl: i.imageUrl,
          unitsSold: 0,
          revenueCents: 0,
        };
      entry.unitsSold += i.quantity;
      entry.revenueCents += i.unitPriceCents * i.quantity - i.lineDiscountCents;
      map.set(i.productId, entry);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

/** Revenue split by payment method — the cash-closing report. */
export function paymentBreakdown(
  orders: Order[],
): Record<PaymentMethod, { count: number; totalCents: number }> {
  const base: Record<PaymentMethod, { count: number; totalCents: number }> = {
    cash: { count: 0, totalCents: 0 },
    credit: { count: 0, totalCents: 0 },
    debit: { count: 0, totalCents: 0 },
    pix: { count: 0, totalCents: 0 },
    wallet: { count: 0, totalCents: 0 },
  };
  for (const o of orders.filter(isRevenue)) {
    base[o.paymentMethod].count += 1;
    base[o.paymentMethod].totalCents += o.totalCents;
  }
  return base;
}

/** Daily revenue series for the trend chart, ascending by date. */
export function dailyRevenue(
  orders: Order[],
): { date: string; revenueCents: number }[] {
  const byDay = new Map<string, number>();
  for (const o of orders.filter(isRevenue)) {
    const day = o.createdAt.slice(0, 10); // YYYY-MM-DD
    byDay.set(day, (byDay.get(day) ?? 0) + o.totalCents);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenueCents]) => ({ date, revenueCents }));
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  completed: "Concluído",
  refunded: "Estornado",
  cancelled: "Cancelado",
  pending: "Pendente",
};
