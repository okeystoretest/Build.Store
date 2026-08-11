"use client";

import { useState } from "react";
import type { User, Campaign, GoalType } from "@/types/domain";
import { createGoal } from "@/lib/db/management-repository";
import { useActiveStoreId } from "@/features/stores/store-context";
import { useToast } from "@/components/ui/toast";
import { parseToCents } from "@/lib/utils/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";

interface GoalFormProps {
  sellers: User[];
  campaigns: Campaign[];
  onCreated: () => void;
}

/**
 * Define a seller goal. Type "general" → monetary target (R$); type "campaign"
 * → item-quantity target + a campaign. Multiple goals per seller are allowed,
 * so this form just appends.
 */
export function GoalForm({ sellers, campaigns, onCreated }: GoalFormProps) {
  const [sellerId, setSellerId] = useState("");
  const [type, setType] = useState<GoalType>("general");
  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState(""); // reais string for general
  const [quantity, setQuantity] = useState(""); // items for campaign
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const activeStoreId = useActiveStoreId();
  const toast = useToast();

  const submit = async () => {
    setError(null);
    if (!sellerId) return setError("Selecione a vendedora");
    if (type === "campaign" && !campaignId)
      return setError("Selecione a campanha");
    if (!activeStoreId) {
      toast.error("Selecione uma loja específica no seletor para criar metas.");
      return;
    }

    setSaving(true);
    try {
      await createGoal({
        sellerId,
        type,
        campaignId: type === "campaign" ? campaignId : null,
        targetCents: type === "general" ? parseToCents(amount) : null,
        targetQuantity: type === "campaign" ? Number(quantity) || 0 : null,
        storeId: activeStoreId,
      });
      setAmount("");
      setQuantity("");
      setCampaignId("");
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-md">
      <div className="space-y-1.5">
        <Label>Vendedora</Label>
        <Select value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
          <option value="">Selecione a vendedora</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Tipo de meta</Label>
        <RadioGroup
          value={type}
          onChange={(v) => setType(v)}
          options={[
            { value: "general", label: "Geral (R$)" },
            { value: "campaign", label: "Campanha (itens)" },
          ]}
        />
      </div>

      {type === "general" ? (
        <div className="space-y-1.5">
          <Label>Meta em valor (R$)</Label>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5.000,00"
          />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Selecione a campanha</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Meta em quantidade de itens</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="50"
            />
          </div>
        </>
      )}

      {error && <p className="px-2 text-label-sm text-error">{error}</p>}

      <Button onClick={submit} disabled={saving}>
        Definir meta
      </Button>
    </div>
  );
}
