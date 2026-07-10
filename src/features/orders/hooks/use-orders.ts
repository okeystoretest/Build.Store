"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveOrdersQuery } from "@/features/orders/hooks/use-live-orders";
import type { Order, OrderStatus } from "@/types/domain";

export type StatusFilter = OrderStatus | "all";

/** Quantidade de pedidos exibidos por página. */
export const ORDERS_PER_PAGE = 5;

/**
 * Order history view state: text search, status filter and date range, applied
 * over the live Dexie order list. Period total is derived from the filtered set
 * so the header figure always matches what's shown. A lista é paginada em
 * blocos de ORDERS_PER_PAGE (5) pedidos.
 */
export function useOrders() {
  const ordersQ = useLiveOrdersQuery();
  const orders = ordersQ.data;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));

  // Reinicia para a primeira página sempre que os filtros mudam.
  useEffect(() => {
    setPage(1);
  }, [query, status, from, to]);

  // Mantém a página dentro dos limites quando a lista encolhe.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const paged = useMemo(
    () =>
      filtered.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE),
    [filtered, page],
  );

  return {
    orders: paged,
    filteredCount: filtered.length,
    total: orders?.length ?? 0,
    periodTotalCents,
    loading: ordersQ.isPending,
    query,
    setQuery,
    status,
    setStatus,
    from,
    setFrom,
    to,
    setTo,
    page,
    setPage,
    pageCount,
  };
}
