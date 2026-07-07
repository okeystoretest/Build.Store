import type { Order, Goal, Campaign } from "@/types/domain";
import { startOfWeek, startOfMonth, isAfter } from "date-fns";

/**
 * Seller-performance aggregations for the Dashboard. Pure functions over the
 * order list, goals and campaigns so they're testable and reused. Commission is
 * applied per campaign sale at the standard rate.
 */

export const COMMISSION_RATE = 0.025;

/** Completed orders attributed to a seller. */
function sellerOrders(orders: Order[], sellerId: string): Order[] {
  return orders.filter(
    (o) => o.status === "completed" && o.sellerId === sellerId,
  );
}

export interface GeneralGoalProgress {
  targetCents: number;
  achievedCents: number;
  /** 0..1, capped at 1 for display. */
  ratio: number;
}

/** Revenue vs. a seller's general (monetary) goal. */
export function generalGoalProgress(
  orders: Order[],
  sellerId: string,
  goal: Goal | undefined,
): GeneralGoalProgress {
  const achievedCents = sellerOrders(orders, sellerId).reduce(
    (s, o) => s + o.totalCents,
    0,
  );
  const targetCents = goal?.targetCents ?? 0;
  const ratio = targetCents > 0 ? Math.min(achievedCents / targetCents, 1) : 0;
  return { targetCents, achievedCents, ratio };
}

/** Largest single completed sale for a seller within a time window. */
export function biggestSaleCents(
  orders: Order[],
  sellerId: string,
  since: Date,
): number {
  return sellerOrders(orders, sellerId)
    .filter((o) => isAfter(new Date(o.createdAt), since))
    .reduce((max, o) => Math.max(max, o.totalCents), 0);
}

export function biggestSaleThisWeek(orders: Order[], sellerId: string): number {
  return biggestSaleCents(orders, sellerId, startOfWeek(new Date(), { weekStartsOn: 1 }));
}

export function biggestSaleThisMonth(orders: Order[], sellerId: string): number {
  return biggestSaleCents(orders, sellerId, startOfMonth(new Date()));
}

export interface CampaignProgress {
  campaign: Campaign;
  targetQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  commissionCents: number;
  ratio: number; // 0..1 capped
}

/**
 * Progress on a seller's campaign goal: items sold under that campaign vs. the
 * target, plus commission earned (2.5% of campaign revenue).
 */
export function campaignProgress(
  orders: Order[],
  sellerId: string,
  goal: Goal,
  campaign: Campaign,
): CampaignProgress {
  const campaignOrders = sellerOrders(orders, sellerId).filter(
    (o) => o.campaignId === campaign.id,
  );

  const soldQuantity = campaignOrders.reduce(
    (n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0),
    0,
  );
  const campaignRevenue = campaignOrders.reduce((s, o) => s + o.totalCents, 0);
  const commissionCents = Math.round(campaignRevenue * COMMISSION_RATE);
  const targetQuantity = goal.targetQuantity ?? 0;
  const remainingQuantity = Math.max(0, targetQuantity - soldQuantity);
  const ratio =
    targetQuantity > 0 ? Math.min(soldQuantity / targetQuantity, 1) : 0;

  return {
    campaign,
    targetQuantity,
    soldQuantity,
    remainingQuantity,
    commissionCents,
    ratio,
  };
}

/** Total items sold by a seller under a given campaign. */
export function itemsSoldInCampaign(
  orders: Order[],
  sellerId: string,
  campaignId: string,
): number {
  return sellerOrders(orders, sellerId)
    .filter((o) => o.campaignId === campaignId)
    .reduce((n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0), 0);
}
