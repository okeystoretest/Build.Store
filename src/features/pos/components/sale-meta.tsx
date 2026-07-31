"use client";

import { useState } from "react";
import type { Campaign, Customer } from "@/types/domain";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { CustomerAutocomplete } from "./customer-autocomplete";
import { useCustomers } from "@/features/customers/hooks/use-customers";

/** Detalhes de campanha capturados no modal do checkout. */
export interface CampaignDetails {
  campaignId: string | null;
  reference: string;
  valueReais: string;
  quantity: string;
}

interface SaleMetaProps {
  customerName: string;
  onCustomerNameChange: (v: string) => void;
  onCustomerSelect?: (customer: Customer | null) => void;
  campaigns: Campaign[];
  isCampaign: boolean;
  onIsCampaignChange: (v: boolean) => void;
  campaignId: string | null;
  onCampaignChange: (id: string | null) => void;
  /** Detalhes extras da campanha (referência, valor, quantidade). */
  campaignDetails?: CampaignDetails;
  onCampaignDetailsChange?: (details: CampaignDetails) => void;
  /** Número da Nota Fiscal (obrigatório para finalizar). */
  invoiceNumber: string;
  onInvoiceNumberChange: (v: string) => void;
}

/**
 * Checkout meta: nome do cliente (obrigatório) + Nota Fiscal + atribuição
 * opcional de campanha.
 *
 * A vendedora responsável NÃO é escolhida aqui: é o usuário logado, capturado
 * automaticamente na tela do PDV.
 *
 * Ao marcar "Este item faz parte de campanha", abre-se um modal para preencher
 * Campanha, Referência, Valor e Quantidade — em vez de expandir campos na
 * própria coluna do checkout.
 */
export function SaleMeta({
  customerName,
  onCustomerNameChange,
  onCustomerSelect,
  campaigns,
  isCampaign,
  onIsCampaignChange,
  campaignId,
  onCampaignChange,
  campaignDetails,
  onCampaignDetailsChange,
  invoiceNumber,
  onInvoiceNumberChange,
}: SaleMetaProps) {
  const { customers } = useCustomers();
  const [modalOpen, setModalOpen] = useState(false);

  const emptyDetails: CampaignDetails = {
    campaignId,
    reference: "",
    valueReais: "",
    quantity: "",
  };

  // Rascunho local do modal; só é aplicado ao confirmar.
  const [draft, setDraft] = useState<CampaignDetails>(
    campaignDetails ?? emptyDetails,
  );

  const openModal = () => {
    setDraft(campaignDetails ?? { ...emptyDetails, campaignId });
    setModalOpen(true);
  };

  const handleCampaignToggle = (checked: boolean) => {
    onIsCampaignChange(checked);
    if (checked) {
      openModal();
    } else {
      onCampaignChange(null);
      onCampaignDetailsChange?.({
        campaignId: null,
        reference: "",
        valueReais: "",
        quantity: "",
      });
    }
  };

  const confirmModal = () => {
    onCampaignChange(draft.campaignId);
    onCampaignDetailsChange?.(draft);
    setModalOpen(false);
  };

  const cancelModal = () => {
    // Se abriu o modal mas nenhuma campanha foi confirmada, desmarca a opção.
    if (!campaignId) onIsCampaignChange(false);
    setModalOpen(false);
  };

  return (
    <div className="space-y-sm rounded-lg border border-outline-variant bg-surface-container-low px-sm py-sm">
      {/* Cliente — compacto e sem borda (integrado ao fundo). */}
      <div className="space-y-1 p-1">
        <Label>
          Cliente <span className="text-on-surface-variant/70">*</span>
        </Label>
        <CustomerAutocomplete
          value={customerName}
          onChange={onCustomerNameChange}
          customers={customers}
          onSelect={(c) => {
            onCustomerNameChange(c.name);
            onCustomerSelect?.(c);
          }}
          onClearSelection={() => onCustomerSelect?.(null)}
          borderless
        />
      </div>

      {/* Nota Fiscal — compacto e sem borda. */}
      <div className="space-y-1 p-1">
        <Label>
          Nota Fiscal (NF) <span className="text-on-surface-variant/70">*</span>
        </Label>
        <Input
          value={invoiceNumber}
          onChange={(e) => onInvoiceNumberChange(e.target.value)}
          placeholder="Ex.: 000123456"
          inputMode="numeric"
          aria-label="Número da Nota Fiscal"
          className="h-11 border-transparent bg-surface-container px-4"
        />
      </div>

      <div className="p-1">
        <Checkbox
          checked={isCampaign}
          onChange={handleCampaignToggle}
          label="Este item faz parte de campanha"
        />
      </div>

      {/* Resumo da campanha confirmada, com atalho para editar. */}
      {isCampaign && campaignId && (
        <button
          type="button"
          onClick={openModal}
          className="flex w-full items-center justify-between rounded-md bg-surface-container px-3 py-2 text-left text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <span>
            {campaigns.find((c) => c.id === campaignId)?.name ?? "Campanha"}
            {campaignDetails?.quantity
              ? ` \u00b7 ${campaignDetails.quantity} itens`
              : ""}
          </span>
          <span className="text-primary">Editar</span>
        </button>
      )}

      <Modal
        open={modalOpen}
        onClose={cancelModal}
        title="Item de campanha"
        className="max-w-md"
      >
        <div className="space-y-md">
          <div className="space-y-1.5">
            <Label>Campanha</Label>
            <Select
              value={draft.campaignId ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, campaignId: e.target.value || null }))
              }
              aria-label="Campanha"
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
            <Label>Referência</Label>
            <Input
              value={draft.reference}
              onChange={(e) =>
                setDraft((d) => ({ ...d, reference: e.target.value }))
              }
              placeholder="Referência do item"
              aria-label="Referência"
            />
          </div>

          <div className="grid grid-cols-2 gap-sm">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                value={draft.valueReais}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, valueReais: e.target.value }))
                }
                inputMode="decimal"
                placeholder="0,00"
                aria-label="Valor"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input
                value={draft.quantity}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, quantity: e.target.value }))
                }
                inputMode="numeric"
                placeholder="0"
                aria-label="Quantidade"
              />
            </div>
          </div>

          <div className="flex justify-end gap-sm pt-1">
            <Button variant="ghost" onClick={cancelModal}>
              Cancelar
            </Button>
            <Button onClick={confirmModal} disabled={!draft.campaignId}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
