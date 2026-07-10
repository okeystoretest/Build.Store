"use client";

import { DollarSign, Receipt, ShoppingBag, RotateCcw, AlertTriangle, TrendingDown, Download } from "lucide-react";
import { useAnalytics } from "@/features/analytics/hooks/use-analytics";
import { useStockAlerts } from "@/features/analytics/hooks/use-stock-alerts";
import { StatCard } from "./stat-card";
import { StockAlertCard } from "./stock-alert-card";
import { RevenueChart } from "./revenue-chart";
import { TopProducts } from "./top-products";
import { PaymentBreakdown } from "./payment-breakdown";
import { formatBRL } from "@/lib/utils/money";
import { generateReportPdf } from "@/features/analytics/report-pdf";
import { useStoreName } from "@/hooks/use-store-name";
import { LoadingArea } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

/**
 * Analytics dashboard. Every figure derives from the live order list, so a sale
 * or refund updates KPIs, chart, ranking and cash-closing report in real time.
 * Inclui dois cards de alerta de estoque (mínimo atingido / próximo do mínimo).
 */
export function AnalyticsScreen() {
  const { summary, top, payments, daily, loading } = useAnalytics();
  const stock = useStockAlerts();
  const storeName = useStoreName();

  const handleDownload = () => {
    generateReportPdf({ summary, top, payments }, storeName);
  };

  if (loading || stock.loading) {
    return (
      <div className="h-full px-margin py-md">
        <LoadingArea label="Carregando relatórios..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-margin py-md">
      <div className="mb-md flex items-center justify-between">
        <h1 className="font-logo text-headline-lg text-primary">Relatórios</h1>
        <Button onClick={handleDownload} variant="secondary">
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Baixar PDF
        </Button>
      </div>

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

      {/* Alertas de estoque */}
      <div className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2">
        <StockAlertCard
          label="Estoque mínimo atingido"
          items={stock.atMinimum}
          icon={AlertTriangle}
          tone="critical"
        />
        <StockAlertCard
          label="Próximos do estoque mínimo"
          items={stock.nearMinimum}
          icon={TrendingDown}
          tone="warning"
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

