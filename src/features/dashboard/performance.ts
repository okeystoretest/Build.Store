import type { Order, Goal, Campaign } from "@/types/domain";
import {
  startOfWeek,
  startOfMonth,
  startOfDay,
  startOfYear,
  isAfter,
} from "date-fns";

/** Período de agregação do Dashboard. */
export type DashboardPeriod = "daily" | "weekly" | "monthly" | "annual";

/** Início do período selecionado, a partir de agora. */
export function periodStart(period: DashboardPeriod, ref: Date = new Date()): Date {
  switch (period) {
    case "daily":
      return startOfDay(ref);
    case "weekly":
      return startOfWeek(ref, { weekStartsOn: 1 });
    case "monthly":
      return startOfMonth(ref);
    case "annual":
      return startOfYear(ref);
  }
}

/** Filtra pedidos criados dentro do período selecionado. */
export function ordersInPeriod(orders: Order[], period: DashboardPeriod): Order[] {
  const since = periodStart(period);
  return orders.filter((o) => isAfter(new Date(o.createdAt), since));
}

/**
 * Cor da barra de progresso conforme a porcentagem concluída (regras do
 * negócio). Retorna um hexadecimal pronto para uso inline.
 *   <= 35%  -> #f8b4c4
 *   <= 70%  -> #f0e6a8
 *   <= 99%  -> #a8d8f0
 *   == 100% -> #b8e8c8
 */
export function progressColor(ratio: number): string {
  const pct = ratio * 100;
  if (pct >= 100) return "#b8e8c8";
  if (pct <= 35) return "#f8b4c4";
  if (pct <= 70) return "#f0e6a8";
  return "#a8d8f0";
}

/**
 * Seller-performance aggregations for the Dashboard. Pure functions over the
 * order list, goals and campaigns so they're testable and reused. Commission is
 * applied per campaign sale at the standard rate.
 */

/**
 * Premiação por item vendido (em centavos). Regra do negócio: R$ 5,00 por item
 * vendido — mas SOMENTE quando o item pertence a uma venda atrelada a uma
 * campanha ATIVA. Vendas sem campanha (meta geral) não geram premiação.
 */
export const COMMISSION_PER_ITEM_CENTS = 500;

/**
 * Premiação total de uma vendedora: R$ 5,00 × itens vendidos em campanhas
 * ATIVAS. Recebe a lista de campanhas para saber quais estão ativas; itens de
 * vendas sem campanha ou de campanhas inativas não contam.
 */
export function sellerCommissionCents(
  orders: Order[],
  sellerId: string,
  campaigns: Campaign[],
): number {
  const activeIds = new Set(
    campaigns.filter((c) => c.active).map((c) => c.id),
  );
  const items = sellerOrders(orders, sellerId)
    .filter((o) => o.campaignId != null && activeIds.has(o.campaignId))
    .reduce((n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0), 0);
  return items * COMMISSION_PER_ITEM_CENTS;
}

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
  // Premiação por item vendido na campanha: R$ 5,00 cada — apenas se a
  // campanha estiver ativa.
  const commissionCents = campaign.active
    ? soldQuantity * COMMISSION_PER_ITEM_CENTS
    : 0;
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
