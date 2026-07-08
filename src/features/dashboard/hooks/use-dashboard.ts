"use client";

import { useMemo } from "react";
import { useLiveOrders } from "@/features/orders/hooks/use-live-orders";
import { useManagement } from "@/features/management/hooks/use-management";
import {
  ordersInPeriod,
  generalGoalProgress,
  campaignProgress,
  sellerCommissionCents,
  COMMISSION_PER_ITEM_CENTS,
  type DashboardPeriod,
  type GeneralGoalProgress,
  type CampaignProgress,
} from "@/features/dashboard/performance";
import type { User } from "@/types/domain";

/** Bloco de desempenho individual de uma vendedora no período. */
export interface SellerBlock {
  seller: User;
  /** Progresso da meta individual (geral/monetária) da vendedora. */
  individual: GeneralGoalProgress;
  /** Premiação: R$ 5,00 por item vendido em campanhas ATIVAS. */
  premiacaoCents: number;
  itemsSold: number;
  /** Progresso em todas as metas de campanha da vendedora. */
  campaigns: CampaignProgress[];
}

/**
 * Dados do Dashboard para o período selecionado: totais agregados e desempenho
 * individual de cada vendedora (meta individual + metas de campanha). Todos os
 * números usam o período completo.
 */
export function useDashboard(period: DashboardPeriod) {
  const orders = useLiveOrders();
  const { sellers, campaigns, goals } = useManagement();

  const data = useMemo(() => {
    const completed = (orders ?? []).filter((o) => o.status === "completed");
    const list = ordersInPeriod(completed, period);

    // ---- Agregado (geral) ----
    const revenueCents = list.reduce((s, o) => s + o.totalCents, 0);
    const itemsSold = list.reduce(
      (n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0),
      0,
    );
    const orderCount = list.length;
    const averageTicketCents = orderCount
      ? Math.round(revenueCents / orderCount)
      : 0;

    // Premiação agregada: itens de campanhas ativas.
    const activeCampaignIds = new Set(
      campaigns.filter((c) => c.active).map((c) => c.id),
    );
    const premiacaoItems = list
      .filter((o) => o.campaignId != null && activeCampaignIds.has(o.campaignId))
      .reduce((n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0), 0);
    const premiacaoCents = premiacaoItems * COMMISSION_PER_ITEM_CENTS;

    const generalTargetCents = goals
      .filter((g) => g.type === "general")
      .reduce((s, g) => s + (g.targetCents ?? 0), 0);
    const generalRatio =
      generalTargetCents > 0 ? Math.min(revenueCents / generalTargetCents, 1) : 0;

    // ---- Individual por vendedora ----
    const sellerBlocks: SellerBlock[] = sellers.map((seller) => {
      const sellerGoals = goals.filter((g) => g.sellerId === seller.id);
      const generalGoal = sellerGoals.find((g) => g.type === "general");

      const individual = generalGoalProgress(list, seller.id, generalGoal);

      const soldBySeller = list
        .filter((o) => o.sellerId === seller.id)
        .reduce((n, o) => n + o.items.reduce((q, i) => q + i.quantity, 0), 0);

      const campaignBlocks = sellerGoals
        .filter((g) => g.type === "campaign")
        .map((g) => {
          const campaign = campaigns.find((c) => c.id === g.campaignId);
          if (!campaign) return null;
          return campaignProgress(list, seller.id, g, campaign);
        })
        .filter((x): x is CampaignProgress => x !== null);

      return {
        seller,
        individual,
        premiacaoCents: sellerCommissionCents(list, seller.id, campaigns),
        itemsSold: soldBySeller,
        campaigns: campaignBlocks,
      };
    });

    return {
      revenueCents,
      itemsSold,
      orderCount,
      averageTicketCents,
      premiacaoCents,
      general: {
        targetCents: generalTargetCents,
        achievedCents: revenueCents,
        ratio: generalRatio,
      },
      sellerBlocks,
    };
  }, [orders, sellers, campaigns, goals, period]);

  return { data, loading: orders === undefined };
}
