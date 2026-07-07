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
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-md grid grid-cols-1 gap-md lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
          <h2 className="text-headline-md text-on-surface">
            Performance de Vendas
          </h2>
          <p className="mt-1 text-label-md text-on-surface-variant">
            Receita diária no período
          </p>
          <div className="mt-md">
            <RevenueChart data={daily} />
          </div>
        </div>

        <TopProducts items={top} />
      </div>

      <div className="mt-md grid grid-cols-1 gap-md lg:grid-cols-2">
        <PaymentBreakdown data={payments} />

        <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
          <h3 className="text-headline-md text-on-surface">
            Resumo do Período
          </h3>
          <div className="mt-md space-y-md">
            <SummaryRow
              label="Pedidos concluídos"
              value={summary.orderCount.toString()}
            />
            <SummaryRow
              label="Itens vendidos"
              value={summary.itemsSold.toString()}
            />
            <SummaryRow
              label="Ticket médio"
              value={formatBRL(summary.averageTicketCents)}
            />
            <SummaryRow
              label="Receita total"
              value={formatBRL(summary.revenueCents)}
              emphasis
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-outline-variant/30 pb-md last:border-0 last:pb-0">
      <span className="text-body-md text-on-surface-variant">{label}</span>
      <span
        className={
          emphasis
            ? "text-headline-md text-primary"
            : "text-body-md font-semibold text-on-surface"
        }
      >
        {value}
      </span>
    </div>
  );
}
