"use client";

import { Minus, Plus, X, ImageIcon } from "lucide-react";
import type { CartItem } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { lineTotalCents } from "@/lib/utils/cart";
import { cn } from "@/lib/utils/cn";

interface CartLineProps {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

/**
 * Uma linha da venda atual.
 *
 * Layout responsivo: no desktop tudo cabe numa faixa horizontal (miniatura,
 * dados, stepper, total, remover). No mobile os controles descem para uma
 * segunda linha — antes tudo era forçado numa linha só, o que espremia o texto
 * e empurrava o total/remover para fora da tela.
 */
export function CartLine({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineProps) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg bg-surface-container-lowest px-3 py-3 shadow-level-1 sm:px-md sm:py-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-md">
        {/* Miniatura */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container sm:h-14 sm:w-14">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon
              className="h-6 w-6 text-on-surface-variant/50"
              strokeWidth={1.5}
            />
          )}
        </div>

        {/* Nome + variação + SKU (trunca em vez de quebrar) */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-medium text-on-surface">
            {item.name}
          </p>
          {(item.color || item.size) && (
            <p className="truncate text-label-sm text-primary">
              {[item.color, item.size].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="truncate text-label-sm text-on-surface-variant">
            SKU: {item.sku}
          </p>
        </div>

        {/* Remover — fica no topo à direita no mobile */}
        <button
          onClick={onRemove}
          aria-label={`Remover ${item.name}`}
          className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container sm:order-none"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        {/*
         * Controles: no mobile ocupam a linha inteira abaixo (basis-full) com o
         * stepper à esquerda e o total à direita. No desktop voltam para a
         * mesma faixa dos demais elementos.
         */}
        <div className="order-4 flex w-full basis-full items-center justify-between gap-3 sm:order-none sm:w-auto sm:basis-auto sm:justify-normal">
          <div className="flex items-center gap-3">
            <StepButton label="Diminuir quantidade" onClick={onDecrement}>
              <Minus className="h-4 w-4" strokeWidth={2} />
            </StepButton>
            <span className="w-6 text-center text-body-md font-semibold tabular-nums text-on-surface">
              {item.quantity}
            </span>
            <StepButton label="Aumentar quantidade" onClick={onIncrement}>
              <Plus className="h-4 w-4" strokeWidth={2} />
            </StepButton>
          </div>

          <p className="text-right text-body-md font-semibold tabular-nums text-on-surface sm:ml-md sm:w-24">
            {formatBRL(lineTotalCents(item))}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  className,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
