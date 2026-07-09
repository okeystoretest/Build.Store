"use client";

import { useState } from "react";
import type { Product } from "@/types/domain";
import { GRADE_SIZES } from "@/types/domain";
import { variationQty } from "@/lib/db/grade";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Variation } from "@/features/pos/hooks/use-cart";

interface VariationPickerProps {
  product: Product | null;
  onClose: () => void;
  onConfirm: (variation: Variation) => void;
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

  if (!product) return null;

  const grade = product.grade ?? [];
  const selectedRow =
    color !== null ? grade.find((r) => r.color === color) : undefined;
  const available =
    selectedRow && size ? variationQty(selectedRow, size) : 0;
  const canAdd = color !== null && size !== null && available > 0;

  const handleConfirm = () => {
    if (!canAdd) return;
    onConfirm({ color, size, available });
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
                  onClick={() => setSize(s)}
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
