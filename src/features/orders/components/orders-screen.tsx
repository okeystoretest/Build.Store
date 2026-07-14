"use client";

import { Search, Cloud, ChevronLeft, ChevronRight } from "lucide-react";
import { useOrders, type StatusFilter } from "@/features/orders/hooks/use-orders";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteOrder } from "@/lib/db/order-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { OrdersTable } from "./orders-table";
import { OrderDetailsModal } from "./order-details-modal";
import { generateReceiptPdf } from "@/features/orders/receipt-pdf";
import { useStoreName } from "@/hooks/use-store-name";
import { LoadingArea } from "@/components/ui/spinner";
import { STATUS_LABELS } from "@/features/analytics/aggregations";
import { formatBRL } from "@/lib/utils/money";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Order } from "@/types/domain";

const STATUS_OPTIONS: StatusFilter[] = [
  "all",
  "completed",
  "refunded",
  "cancelled",
];

/**
 * Histórico de Pedidos. Reads live orders from Dexie, filters by search/status/
 * date, and supports refund (which restocks and re-queues for sync). Refunding
 * updates stock and the list instantly via the live query.
 */
export function OrdersScreen() {
  const o = useOrders();
  const { canRefund } = useAuth();
  const queryClient = useQueryClient();
  const storeName = useStoreName();
  const [details, setDetails] = useState<Order | null>(null);

  const handleRefund = async (order: Order) => {
    // Controle de acesso: apenas lojista/admin podem estornar.
    if (!canRefund) return;
    const ok = window.confirm(
      `Estornar o pedido ${order.reference}? As peças voltam ao estoque e o registro da venda será APAGADO.`,
    );
    if (!ok) return;
    // Repõe o estoque e apaga o pedido; invalida para refletir na hora.
    await deleteOrder(order.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.orders }),
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
    ]);
  };

  const handleReprint = (order: Order) => {
    generateReceiptPdf(order, storeName);
  };

  if (o.loading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando pedidos..." />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-outline-variant/50 px-margin py-md sm:gap-md">
        <h1 className="font-logo text-headline-lg-mobile text-primary sm:text-headline-lg">Histórico de Pedidos</h1>
        <div className="relative w-full sm:ml-auto sm:w-80">
          <Search
            className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant"
            strokeWidth={1.75}
          />
          <input
            value={o.query}
            onChange={(e) => o.setQuery(e.target.value)}
            placeholder="Buscar pedido ou cliente..."
            aria-label="Buscar pedido ou cliente"
            className="h-14 w-full rounded-full border border-outline-variant bg-surface pl-14 pr-6 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-label-sm font-semibold text-on-surface-variant">
          <Cloud className="h-4 w-4" strokeWidth={1.75} />
          Sincronizado
        </div>
      </header>

      <div className="flex-1 space-y-md overflow-y-auto px-margin py-md">
        <div className="grid grid-cols-1 gap-md lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-end gap-md rounded-lg bg-surface-container-lowest px-md py-md shadow-level-1">
            <div className="space-y-1.5">
              <Label>Intervalo de datas</Label>
              <div className="flex items-center gap-sm">
                <Input
                  type="date"
                  value={o.from}
                  onChange={(e) => o.setFrom(e.target.value)}
                  className="w-36 sm:w-44"
                  aria-label="Data inicial"
                />
                <span className="text-on-surface-variant">até</span>
                <Input
                  type="date"
                  value={o.to}
                  onChange={(e) => o.setTo(e.target.value)}
                  className="w-36 sm:w-44"
                  aria-label="Data final"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status do pedido</Label>
              <Select
                value={o.status}
                onChange={(e) => o.setStatus(e.target.value as StatusFilter)}
                className="w-full sm:w-52"
                aria-label="Status do pedido"
              >
                <option value="all">Todos os Status</option>
                {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col justify-center rounded-lg bg-primary-fixed/50 px-lg py-md text-right">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
              Total do período
            </p>
            <p className="text-headline-md text-primary sm:text-headline-lg">
              {formatBRL(o.periodTotalCents)}
            </p>
          </div>
        </div>

        <OrdersTable
          orders={o.orders}
          onViewDetails={setDetails}
          onReprint={handleReprint}
          onRefund={handleRefund}
          canRefund={canRefund}
        />

        <OrderDetailsModal order={details} onClose={() => setDetails(null)} />

        <div className="flex flex-wrap items-center justify-between gap-md px-1">
          <p className="text-label-sm text-on-surface-variant">
            Exibindo {o.orders.length} de {o.filteredCount} pedidos filtrados
            {o.filteredCount !== o.total && ` (${o.total} no total)`}
          </p>

          {o.pageCount > 1 && (
            <div className="flex items-center gap-sm">
              <button
                onClick={() => o.setPage(o.page - 1)}
                disabled={o.page <= 1}
                aria-label="Página anterior"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <span className="text-label-md text-on-surface-variant">
                Página {o.page} de {o.pageCount}
              </span>
              <button
                onClick={() => o.setPage(o.page + 1)}
                disabled={o.page >= o.pageCount}
                aria-label="Próxima página"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
