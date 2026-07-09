"use client";

import { useMemo, useRef, useState } from "react";
import {
  TrendingUp,
  Package,
  Wallet,
  Receipt,
  Maximize,
  Minimize,
  Trophy,
} from "lucide-react";
import { useDashboard, type SellerBlock } from "@/features/dashboard/hooks/use-dashboard";
import { progressColor, type DashboardPeriod } from "@/features/dashboard/performance";
import { formatBRL } from "@/lib/utils/money";
import { ToggleGroup } from "@/components/ui/toggle-group";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "annual", label: "Anual" },
];

/** Cores de destaque dos cards de métrica (ícone + borda de realce à esquerda). */
const METRIC_STYLES = {
  revenue: { bg: "bg-[#e8f5e9]", fg: "text-[#2e7d32]", border: "border-[#2e7d32]" },
  ticket: { bg: "bg-[#e3f2fd]", fg: "text-[#1565c0]", border: "border-[#1565c0]" },
  items: { bg: "bg-[#f3e5f5]", fg: "text-[#7b1fa2]", border: "border-[#7b1fa2]" },
  prize: { bg: "bg-[#fff3e0]", fg: "text-[#e65100]", border: "border-[#e65100]" },
} as const;

/** Cor do troféu conforme a posição no ranking de premiação. */
function trophyColor(rank: number): string {
  if (rank === 0) return "#f6b93b"; // ouro
  if (rank === 1) return "#a4b0be"; // prata
  if (rank === 2) return "#cd7f32"; // bronze
  return "#c8b6d6"; // demais — lilás suave da paleta
}

/**
 * Dashboard — totais agregados do período e desempenho individual por
 * vendedora, com filtro por campanha. Premiação (R$ 5,00/item) conta apenas
 * itens de campanhas ativas. Barras de progresso animadas, ícones coloridos,
 * troféu de ranking por vendedora e tipografia ampliada para leitura à
 * distância (uso em loja).
 */
export function DashboardScreen() {
  const [period, setPeriod] = useState<DashboardPeriod>("daily");
  const { data } = useDashboard(period);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  // Ranking: vendedoras ordenadas por premiação (maior primeiro).
  const ranked = useMemo(
    () => [...data.sellerBlocks].sort((a, b) => b.premiacaoCents - a.premiacaoCents),
    [data.sellerBlocks],
  );

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto bg-background px-margin py-md"
    >
      <div className="flex flex-wrap items-end justify-between gap-md">
        <h1 className="font-heading text-display-sm text-primary">Dashboard</h1>
        <div className="flex flex-wrap items-end gap-md">
          <ToggleGroup
            aria-label="Período"
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
          />
          <button
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Sair da tela cheia" : "Modo tela cheia"}
            title={fullscreen ? "Sair da tela cheia" : "Modo tela cheia"}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            {fullscreen ? (
              <Minimize className="h-6 w-6" strokeWidth={1.75} />
            ) : (
              <Maximize className="h-6 w-6" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      <div className="mt-md space-y-md">
        {/* Cards agregados */}
        <div className="grid grid-cols-2 gap-md xl:grid-cols-4">
          <Metric icon={TrendingUp} label="Recebido no período" value={formatBRL(data.revenueCents)} style={METRIC_STYLES.revenue} />
          <Metric icon={Receipt} label="Ticket médio" value={formatBRL(data.averageTicketCents)} style={METRIC_STYLES.ticket} />
          <Metric icon={Package} label="Itens vendidos" value={data.itemsSold.toLocaleString("pt-BR")} style={METRIC_STYLES.items} />
          <Metric icon={Wallet} label="Premiação (campanhas ativas)" value={formatBRL(data.premiacaoCents)} style={METRIC_STYLES.prize} />
        </div>

        {/* Meta geral da loja — sempre visível (não afetada pelo filtro). */}
        <ProgressBlock
          title="Meta Geral da Loja"
          ratio={data.general.ratio}
          left={`Recebido: ${formatBRL(data.general.achievedCents)}`}
          right={`Meta: ${formatBRL(data.general.targetCents)}`}
        />

        {/* Desempenho individual por vendedora (ranking) */}
        <div>
          <h2 className="font-heading mb-sm text-headline-md text-on-surface">
            Desempenho por vendedora
          </h2>
          {ranked.length === 0 ? (
            <p className="rounded-lg bg-surface-container-lowest px-md py-xl text-body-lg text-on-surface-variant shadow-level-1">
              Nenhuma vendedora cadastrada.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-md xl:grid-cols-2">
              {ranked.map((block, i) => (
                <SellerCard key={block.seller.id} block={block} rank={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SellerCard({ block, rank }: { block: SellerBlock; rank: number }) {
  const { seller, individual, premiacaoCents, itemsSold, campaigns } = block;
  const medal = trophyColor(rank);

  return (
    <div
      className="animate-pop-in rounded-xl border bg-surface-container-lowest p-md shadow-level-1"
      style={{ borderColor: medal }}
    >
      <div className="flex items-center justify-between gap-md">
        <span className="flex items-center gap-3">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed/60 text-headline-md font-semibold text-primary">
            {seller.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.photoUrl} alt={seller.fullName} className="h-full w-full object-cover" />
            ) : (
              seller.fullName.slice(0, 2).toUpperCase()
            )}
          </span>
          <span className="flex items-center gap-2">
            <Trophy
              className="h-6 w-6 shrink-0"
              style={{ color: medal }}
              strokeWidth={2}
              aria-label={`Ranking: ${rank + 1}º`}
            />
            <p className="text-headline-md font-medium text-on-surface">
              {seller.fullName}
            </p>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1.5 rounded-full bg-[#fff3e0] px-3 py-1.5 text-body-md font-semibold text-[#e65100]">
            <Wallet className="h-5 w-5" strokeWidth={1.75} />
            {formatBRL(premiacaoCents)}
          </span>
          <span className="text-label-sm text-on-surface-variant">
            {itemsSold} {itemsSold === 1 ? "item" : "itens"}
          </span>
        </span>
      </div>

      {/* Metas: individual + campanhas, agrupadas e destacadas. */}
      <div className="mt-md space-y-md rounded-lg border border-primary-container/50 bg-surface-container-low p-md">
        <Bar
          label="Meta individual"
          ratio={individual.ratio}
          detail={`${formatBRL(individual.achievedCents)} / ${formatBRL(individual.targetCents)}`}
        />
        {campaigns.map((cb) => (
          <Bar
            key={cb.campaign.id}
            label={cb.campaign.name}
            ratio={cb.ratio}
            detail={`${cb.soldQuantity} / ${cb.targetQuantity} itens`}
          />
        ))}
      </div>
    </div>
  );
}

function Bar({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number;
  detail: string;
}) {
  const pct = Math.round(ratio * 100);
  const color = progressColor(ratio);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-md">
        <span className="text-label-md uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        <span className="text-headline-md font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      {/* Valor da meta em destaque, tamanho ampliado para leitura rápida. */}
      <p className="mt-0.5 text-body-lg font-semibold tabular-nums text-on-surface">
        {detail}
      </p>
      <div className="mt-2 h-4 overflow-hidden rounded-full bg-surface-container">
        <div
          className="animate-bar-fill h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            ["--bar-target" as string]: `${pct}%`,
          }}
        />
      </div>
    </div>
  );
}

function ProgressBlock({
  title,
  ratio,
  left,
  right,
}: {
  title: string;
  ratio: number;
  left: string;
  right: string;
}) {
  const pct = Math.round(ratio * 100);
  const color = progressColor(ratio);
  return (
    <div
      className="rounded-xl border bg-surface-container-lowest p-md shadow-level-1"
      style={{ borderColor: color }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-headline-md text-on-surface">{title}</h2>
        <span className="text-display-sm font-semibold tabular-nums" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="mt-sm h-5 overflow-hidden rounded-full bg-surface-container">
        <div
          className="animate-bar-fill h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            ["--bar-target" as string]: `${pct}%`,
          }}
        />
      </div>
      <div className="mt-sm flex items-center justify-between text-body-lg font-semibold tabular-nums text-on-surface">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  style,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  style: { bg: string; fg: string; border: string };
}) {
  return (
    <div
      className={`rounded-xl border ${style.border} bg-surface-container-lowest p-md shadow-level-1`}
    >
      <div className="flex items-center justify-between gap-sm">
        <p className="text-label-md uppercase tracking-wide text-on-surface-variant">
          {label}
        </p>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.fg}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-2 text-headline-lg text-primary">{value}</p>
    </div>
  );
}
