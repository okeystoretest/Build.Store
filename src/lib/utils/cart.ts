import type { CartItem, Order } from "@/types/domain";

/** Pure cart math — no side effects, easy to unit test. */

export function lineTotalCents(item: CartItem): number {
  return item.unitPriceCents * item.quantity - item.lineDiscountCents;
}

export function subtotalCents(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + lineTotalCents(i), 0);
}

export function itemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

/** Compute order totals given a global discount applied after line totals. */
export function computeTotals(
  items: CartItem[],
  globalDiscountCents = 0,
): Totals {
  const subtotal = subtotalCents(items);
  const discount = Math.min(globalDiscountCents, subtotal);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    totalCents: subtotal - discount,
  };
}

/** Change owed for a cash tender. Never negative. */
export function changeCents(totalCents: number, tenderedCents: number): number {
  return Math.max(0, tenderedCents - totalCents);
}
