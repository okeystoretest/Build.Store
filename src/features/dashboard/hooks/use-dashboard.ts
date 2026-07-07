"use client";

import { useMemo } from "react";
import { useLiveOrders } from "@/features/orders/hooks/use-live-orders";
import { useManagement } from "@/features/management/hooks/use-management";
import {
  generalGoalProgress,
  biggestSaleThisWeek,
  biggestSaleThisMonth,
  campaignProgress,
} from "@/features/dashboard/performance";
import type { Goal } from "@/types/domain";

/**
 * Dashboard data for a selected seller (+ optional campaign filter). Combines
 * the live order list with the seller's goals to produce all the figures the
 * dashboard renders.
 */
export function useDashboard(sellerId: string | null, campaignId: string | null) {
  const orders = useLiveOrders();
  const { sellers, campaigns, goals } = useManagement();

  const data = useMemo(() => {
    const list = orders ?? [];
    if (!sellerId) return null;

    const sellerGoals = goals.filter((g) => g.sellerId === sellerId);
    const generalGoal: Goal | undefined = sellerGoals.find(
      (g) => g.type === "general",
    );

    const general = generalGoalProgress(list, sellerId, generalGoal);
    const weekBest = biggestSaleThisWeek(list, sellerId);
    const monthBest = biggestSaleThisMonth(list, sellerId);

    // Campaign progress: for the selected campaign if filtered, else all the
    // seller's campaign goals.
    const campaignGoals = sellerGoals.filter(
      (g) => g.type === "campaign" && (!campaignId || g.campaignId === campaignId),
    );
    const campaignBlocks = campaignGoals
      .map((g) => {
        const campaign = campaigns.find((c) => c.id === g.campaignId);
        if (!campaign) return null;
        return campaignProgress(list, sellerId, g, campaign);
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { general, weekBest, monthBest, campaignBlocks };
  }, [orders, goals, campaigns, sellerId, campaignId]);

  return { sellers, campaigns, data };
}
