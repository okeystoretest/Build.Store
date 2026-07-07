"use client";

import { DollarSign, Receipt, ShoppingBag, RotateCcw } from "lucide-react";
import { useAnalytics } from "@/features/analytics/hooks/use-analytics";
import { StatCard } from "./stat-card";
import { RevenueChart } from "./revenue-chart";
import { TopProducts } from "./top-products";
import { PaymentBreakdown } from "./payment-breakdown";
import { formatBRL } from "@/lib/utils/money";

/**
 * Analytics dashboard. Every figure derives from the live order list, so a sale
 * or refund updates KPIs, chart, ranking and cash-closing report in real time.
 */
export function AnalyticsScreen() {
  const { summary, top, payments, daily } = useAnalytics();

  return (
    <div className="h-full overflow-y-auto px-margin py-md">
      <h1 className="mb-md text-headline-lg text-primary">Relatórios</h1>

      <div className="grid grid-cols-2 gap-sm lg:grid-cols-4">
        <StatCard
          label="Receita Total"
          value={formatBRL(summary.revenueCents)}
          icon={DollarSign}
        />
        <StatCard
          label="Ticket Médio"
          value={formatBRL(summary.averageTicketCents)}
          icon={Receipt}
        />
        <StatCard
          label="Itens Vendidos"
          value={summary.itemsSold.toLocaleString("pt-BR")}
          icon={ShoppingBag}
        />
        <StatCard
          label="Taxa de Estorno"
          value={`${(summary.refundRate * 100).toFixed(1)}%`}
          icon={RotateCcw}
        />
      </div>

      {/* Chart + ranking + cash-closing consolidated into one row to cut scroll. */}
      <div className="mt-sm grid grid-cols-1 gap-sm xl:grid-cols-[1.6fr_1fr_1fr]">
        <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
          <h2 className="text-headline-md text-on-surface">
            Performance de Vendas
          </h2>
          <p className="mt-1 text-label-md text-on-surface-variant">
            Receita diária no período
          </p>
          <div className="mt-sm">
            <RevenueChart data={daily} />
          </div>
        </div>

        <TopProducts items={top} />
        <PaymentBreakdown data={payments} />
      </div>
    </div>
  );
}

