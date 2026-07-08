"use client";

import type { User, Campaign } from "@/types/domain";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface SaleMetaProps {
  customerName: string;
  onCustomerNameChange: (v: string) => void;
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
 * Checkout meta: nome do cliente (obrigatório) + vendedora responsável +
 * atribuição opcional de campanha. A venda só finaliza com o nome do cliente
 * preenchido; quando "faz parte de campanha" está marcado, exige uma campanha.
 */
export function SaleMeta({
  customerName,
  onCustomerNameChange,
  sellers,
  campaigns,
  sellerId,
  onSellerChange,
  isCampaign,
  onIsCampaignChange,
  campaignId,
  onCampaignChange,
}: SaleMetaProps) {
  const customerMissing = customerName.trim().length === 0;
  return (
    <div className="space-y-md rounded-lg bg-surface-container-low px-md py-md">
      <div className="space-y-1.5">
        <Label>
          Cliente <span className="text-error">*</span>
        </Label>
        <Input
          value={customerName}
          onChange={(e) => onCustomerNameChange(e.target.value)}
          placeholder="Nome do cliente"
          aria-label="Nome do cliente"
          aria-required="true"
        />
        {customerMissing && (
          <p className="px-2 text-label-sm text-error">
            Informe o nome do cliente para finalizar a venda.
          </p>
        )}
      </div>

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
