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

/** A single row in the current sale. Pill stepper, thumbnail, line total. */
export function CartLine({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartLineProps) {
  return (
    <div className="flex items-center gap-md rounded-lg bg-surface-container-lowest px-md py-sm shadow-level-1">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
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

      <div className="min-w-0 flex-1">
        <p className="truncate text-body-md font-medium text-on-surface">
          {item.name}
        </p>
        {(item.color || item.size) && (
          <p className="text-label-sm text-primary">
            {[item.color, item.size].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-label-sm text-on-surface-variant">SKU: {item.sku}</p>
      </div>

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

      <p className="w-24 text-right text-body-md font-semibold tabular-nums text-on-surface">
        {formatBRL(lineTotalCents(item))}
      </p>

      <button
        onClick={onRemove}
        aria-label={`Remover ${item.name}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
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
        "flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant transition-colors hover:border-primary-container hover:text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}
