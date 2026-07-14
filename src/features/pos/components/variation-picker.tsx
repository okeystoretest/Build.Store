"use client";

import { useState } from "react";
import type { Product } from "@/types/domain";
import { GRADE_SIZES } from "@/types/domain";
import { variationQty } from "@/lib/db/grade";
import { Minus, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Variation } from "@/features/pos/hooks/use-cart";

interface VariationPickerProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (variation: Variation, quantity: number) => void;
}

/**
 * Seletor de variação para venda: escolhe COR e TAMANHO antes de adicionar ao
 * carrinho. Combinações sem estoque aparecem desabilitadas ("esgotado"). O
 * botão Adicionar só habilita com uma variação disponível selecionada.
 */
export function VariationPicker({
  product,
  onClose,
  onConfirm,
}: VariationPickerProps) {
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const grade = product.grade ?? [];
  const selectedRow =
    color !== null ? grade.find((r) => r.color === color) : undefined;
  const available =
    selectedRow && size ? variationQty(selectedRow, size) : 0;
  const canAdd = color !== null && size !== null && available > 0;

  // Quantidade efetiva nunca passa do estoque disponível.
  const qty = Math.min(Math.max(1, quantity), Math.max(1, available));

  const handleConfirm = () => {
    if (!canAdd) return;
    onConfirm({ color, size, available }, qty);
    onClose();
  };

  return (
    <Modal open={!!product} onClose={onClose} title={product.name}>
      <div className="space-y-lg">
        {/* Cor */}
        <div className="space-y-sm">
          <p className="text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            Cor
          </p>
          <div className="flex flex-wrap gap-sm">
            {grade.map((row, i) => {
              const rowTotal = GRADE_SIZES.reduce(
                (sum, s) => sum + variationQty(row, s),
                0,
              );
              const soldOut = rowTotal <= 0;
              const active = color === row.color;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    setColor(row.color);
                    setSize(null);
                    setQuantity(1);
                  }}
                  className={cn(
                    "rounded-full border px-4 py-2 text-label-md transition-colors",
                    active
                      ? "border-primary bg-primary-fixed/60 text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-primary-container",
                    soldOut && "cursor-not-allowed opacity-40",
                  )}
                >
                  {row.color ?? "—"}
                  {soldOut && " (esgotado)"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tamanho */}
        <div className="space-y-sm">
          <p className="text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            Tamanho
          </p>
          <div className="flex flex-wrap gap-sm">
            {GRADE_SIZES.map((s) => {
              const qty = selectedRow ? variationQty(selectedRow, s) : 0;
              const soldOut = !selectedRow || qty <= 0;
              const active = size === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={soldOut}
                  onClick={() => {
                    setSize(s);
                    setQuantity(1);
                  }}
                  className={cn(
                    "flex min-w-[3.5rem] flex-col items-center rounded-lg border px-3 py-2 transition-colors",
                    active
                      ? "border-primary bg-primary-fixed/60 text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-primary-container",
                    soldOut && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="text-body-md font-semibold">{s}</span>
                  <span className="text-label-sm">
                    {soldOut ? "esgotado" : `${qty} un`}
                  </span>
                </button>
              );
            })}
          </div>
          {!color && (
            <p className="text-label-sm text-on-surface-variant">
              Escolha uma cor primeiro.
            </p>
          )}
        </div>

        {/* Quantidade — limitada ao estoque da variação escolhida */}
        <div className="space-y-sm">
          <p className="text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            Quantidade
          </p>
          <div className="flex items-center gap-md">
            <button
              type="button"
              disabled={!canAdd || qty <= 1}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="h-4 w-4" strokeWidth={2} />
            </button>
            <span className="min-w-[3rem] text-center text-headline-md font-semibold tabular-nums text-on-surface">
              {canAdd ? qty : 0}
            </span>
            <button
              type="button"
              disabled={!canAdd || qty >= available}
              onClick={() =>
                setQuantity((q) => Math.min(available, q + 1))
              }
              aria-label="Aumentar quantidade"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-sm">
          <p className="text-body-md text-on-surface-variant">
            {canAdd
              ? `Disponível: ${available} un`
              : "Selecione cor e tamanho"}
          </p>
          <div className="flex gap-sm">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={!canAdd}>
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
