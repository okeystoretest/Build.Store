"use client";

import { useMemo, useState } from "react";
import { useLiveOrders } from "@/features/orders/hooks/use-live-orders";
import type { Order, OrderStatus } from "@/types/domain";

export type StatusFilter = OrderStatus | "all";

/**
 * Order history view state: text search, status filter and date range, applied
 * over the live Dexie order list. Period total is derived from the filtered set
 * so the header figure always matches what's shown.
 */
export function useOrders() {
  const orders = useLiveOrders();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo<Order[]>(() => {
    if (!orders) return [];
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      const matchesQuery =
        !q ||
        o.reference.toLowerCase().includes(q) ||
        (o.customerName?.toLowerCase().includes(q) ?? false);
      const matchesStatus = status === "all" || o.status === status;
      const day = o.createdAt.slice(0, 10);
      const matchesFrom = !from || day >= from;
      const matchesTo = !to || day <= to;
      return matchesQuery && matchesStatus && matchesFrom && matchesTo;
    });
  }, [orders, query, status, from, to]);

  const periodTotalCents = useMemo(
    () =>
      filtered
        .filter((o) => o.status === "completed")
        .reduce((s, o) => s + o.totalCents, 0),
    [filtered],
  );

  return {
    orders: filtered,
    total: orders?.length ?? 0,
    periodTotalCents,
    loading: orders === undefined,
    query,
    setQuery,
    status,
    setStatus,
    from,
    setFrom,
    to,
    setTo,
  };
}
