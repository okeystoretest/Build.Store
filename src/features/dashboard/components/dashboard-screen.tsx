"use client";

import { useState } from "react";
import { TrendingUp, Calendar, Package, Wallet } from "lucide-react";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { formatBRL } from "@/lib/utils/money";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

/**
 * Dashboard — per-seller performance. Pick a seller (and optionally filter by
 * campaign) to see the general goal progress, biggest sales of the week/month,
 * and campaign progress with earned commission (2.5%).
 */
export function DashboardScreen() {
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const { sellers, campaigns, data } = useDashboard(sellerId, campaignId);

  return (
    <div className="h-full overflow-y-auto px-margin py-md">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <h1 className="text-headline-lg text-primary">Dashboard</h1>
        <div className="flex flex-wrap items-end gap-md">
          <div className="space-y-1.5">
            <Label>Vendedora</Label>
            <Select
              value={sellerId ?? ""}
              onChange={(e) => setSellerId(e.target.value || null)}
              className="w-56"
              aria-label="Selecionar vendedora"
            >
              <option value="">Selecione a vendedora</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select
              value={campaignId ?? ""}
              onChange={(e) => setCampaignId(e.target.value || null)}
              className="w-52"
              aria-label="Filtrar por campanha"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {!sellerId || !data ? (
        <EmptyState />
      ) : (
        <div className="mt-md space-y-md">
          {/* Metric cards */}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <Metric
              icon={Calendar}
              label="Maior venda da semana"
              value={formatBRL(data.weekBest)}
            />
            <Metric
              icon={TrendingUp}
              label="Maior venda do mês"
              value={formatBRL(data.monthBest)}
            />
            <Metric
              icon={Package}
              label="Meta geral"
              value={formatBRL(data.general.targetCents)}
            />
          </div>

          {/* General goal bar */}
          <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">Meta Geral</h2>
              <span className="text-headline-md text-primary">
                {Math.round(data.general.ratio * 100)}%
              </span>
            </div>
            <div className="mt-md h-4 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${data.general.ratio * 100}%` }}
              />
            </div>
            <div className="mt-sm flex items-center justify-between text-label-md text-on-surface-variant">
              <span>Arrecadado: {formatBRL(data.general.achievedCents)}</span>
              <span>Meta: {formatBRL(data.general.targetCents)}</span>
            </div>
          </div>

          {/* Campaign progress */}
          {data.campaignBlocks.length > 0 && (
            <div className="space-y-md">
              <h2 className="text-headline-md text-on-surface">
                Metas de Campanha
              </h2>
              {data.campaignBlocks.map((cb) => (
                <div
                  key={cb.campaign.id}
                  className="rounded-lg bg-surface-container-lowest p-md shadow-level-1"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-body-lg font-medium text-on-surface">
                      {cb.campaign.name}
                    </h3>
                    <span className="flex items-center gap-2 text-label-md text-on-surface-variant">
                      <Wallet className="h-4 w-4" strokeWidth={1.75} />
                      Comissão: {formatBRL(cb.commissionCents)}
                    </span>
                  </div>

                  <div className="mt-md grid grid-cols-3 gap-md">
                    <Stat label="Meta (itens)" value={cb.targetQuantity.toString()} />
                    <Stat label="Vendidos" value={cb.soldQuantity.toString()} />
                    <Stat
                      label="Faltam"
                      value={cb.remainingQuantity.toString()}
                      accent={cb.remainingQuantity > 0}
                    />
                  </div>

                  <div className="mt-md h-3 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${cb.ratio * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-label-sm text-on-surface-variant">
                    {Math.round(cb.ratio * 100)}% concluído
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <div className="flex items-center justify-between">
        <p className="text-label-md uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed/60 text-primary">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-2 text-headline-lg text-primary">{value}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-headline-md",
          accent ? "text-primary" : "text-on-surface",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-xl flex flex-col items-center justify-center gap-3 py-xl text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <TrendingUp className="h-7 w-7 text-on-surface-variant/60" strokeWidth={1.5} />
      </div>
      <p className="text-body-md text-on-surface-variant">
        Selecione uma vendedora para ver o desempenho.
      </p>
    </div>
  );
}
