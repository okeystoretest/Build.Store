"use client";

import { useMemo } from "react";
import { useLiveOrders } from "@/features/orders/hooks/use-live-orders";
import {
  salesSummary,
  topProducts,
  paymentBreakdown,
  dailyRevenue,
} from "@/features/analytics/aggregations";

/** All dashboard figures derived from the live order list in one place. */
export function useAnalytics() {
  const orders = useLiveOrders();

  return useMemo(() => {
    const list = orders ?? [];
    return {
      loading: orders === undefined,
      summary: salesSummary(list),
      top: topProducts(list, 4),
      payments: paymentBreakdown(list),
      daily: dailyRevenue(list),
    };
  }, [orders]);
}
