"use client";

import { useMemo } from "react";
import { useLiveOrdersQuery } from "@/features/orders/hooks/use-live-orders";
import {
  salesSummary,
  topProducts,
  paymentBreakdown,
  dailyRevenue,
} from "@/features/analytics/aggregations";

/** All dashboard figures derived from the live order list in one place. */
export function useAnalytics() {
  const ordersQ = useLiveOrdersQuery();
  const orders = ordersQ.data;

  return useMemo(() => {
    const list = orders ?? [];
    return {
      loading: ordersQ.isPending,
      error: ordersQ.error ?? null,
      summary: salesSummary(list),
      top: topProducts(list, 4),
      payments: paymentBreakdown(list),
      daily: dailyRevenue(list),
    };
  }, [orders, ordersQ.isPending, ordersQ.error]);
}
