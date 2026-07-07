"use client";

import type { User, Campaign } from "@/types/domain";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface SaleMetaProps {
  sellers: User[];
  campaigns: Campaign[];
  sellerId: string | null;
  onSellerChange: (id: string | null) => void;
  isCampaign: boolean;
  onIsCampaignChange: (v: boolean) => void;
  campaignId: string | null;
  onCampaignChange: (id: string | null) => void;
}

/**
 * Checkout meta: responsible seller + optional campaign attribution.
 * When "faz parte de campanha" is checked, a campaign dropdown appears and the
 * POS screen blocks finalize until one is chosen.
 */
export function SaleMeta({
  sellers,
  campaigns,
  sellerId,
  onSellerChange,
  isCampaign,
  onIsCampaignChange,
  campaignId,
  onCampaignChange,
}: SaleMetaProps) {
  return (
    <div className="space-y-md rounded-lg bg-surface-container-low px-md py-md">
      <div className="space-y-1.5">
        <Label>Vendedora responsável</Label>
        <Select
          value={sellerId ?? ""}
          onChange={(e) => onSellerChange(e.target.value || null)}
          aria-label="Vendedora responsável"
        >
          <option value="">Selecione a vendedora</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </div>

      <Checkbox
        checked={isCampaign}
        onChange={(v) => {
          onIsCampaignChange(v);
          if (!v) onCampaignChange(null);
        }}
        label="Este item faz parte de campanha"
      />

      {isCampaign && (
        <div className="space-y-1.5">
          <Label>Campanha ativa</Label>
          <Select
            value={campaignId ?? ""}
            onChange={(e) => onCampaignChange(e.target.value || null)}
            aria-label="Campanha ativa"
          >
            <option value="">Selecione a campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {!campaignId && (
            <p className="px-2 text-label-sm text-error">
              Selecione uma campanha para finalizar a venda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
