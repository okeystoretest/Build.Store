"use client";

import { Pencil, ImageIcon, Eye } from "lucide-react";
import type { Product } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { stockLevel } from "@/features/inventory/types";
import { cn } from "@/lib/utils/cn";

interface ProductCardProps {
  product: Product;
  /** Abre o produto: Admin edita; demais perfis visualizam. */
  onOpen: (product: Product) => void;
  /** True apenas para Admin (mostra o ícone de edição). */
  canManage?: boolean;
}

/**
 * Card de produto (modo grade). O card inteiro é clicável: Admin abre a edição,
 * Lojista/Vendedora abrem a visualização somente leitura. O ícone no canto
 * reflete a ação disponível (lápis para Admin, olho para os demais).
 */
export function ProductCard({ product, onOpen, canManage = false }: ProductCardProps) {
  const level = stockLevel(product);
  const low = level !== "ok";

  return (
    <button
      onClick={() => onOpen(product)}
      className="flex flex-col rounded-lg bg-surface-container-lowest p-sm text-left shadow-level-1 transition-shadow hover:shadow-level-2"
    >
      <div className="relative">
        <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-container">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-9 w-9 text-on-surface-variant/40" strokeWidth={1.5} />
          )}
        </div>
        {low && (
          <span className="absolute left-2 top-2 rounded-full bg-primary-container px-2.5 py-0.5 text-label-sm font-semibold uppercase tracking-wide text-on-primary-container">
            ! Baixo
          </span>
        )}
      </div>

      <div className="mt-sm flex flex-1 flex-col px-1">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
          Ref: {product.sku}
        </p>
        <p className="mt-0.5 line-clamp-2 text-label-md font-medium text-on-surface">
          {product.name}
        </p>

        <div className="mt-auto flex items-end justify-between pt-sm">
          <div>
            <p className="text-body-lg font-semibold text-primary">
              {formatBRL(product.priceCents)}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-label-sm">
              <span className={cn("h-2 w-2 rounded-full", low ? "bg-error" : "bg-[#3ba55c]")} />
              <span className={low ? "text-error" : "text-on-surface-variant"}>
                {product.stock}
              </span>
            </p>
          </div>

          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary"
          >
            {canManage ? (
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            )}
          </span>
        </div>
      </div>
    </button>
  );
}

/** Linha de produto (modo lista). */
export function ProductRow({ product, onOpen, canManage = false }: ProductCardProps) {
  const low = stockLevel(product) !== "ok";

  return (
    <button
      onClick={() => onOpen(product)}
      className="flex w-full items-center gap-md rounded-lg bg-surface-container-lowest px-md py-sm text-left shadow-level-1 transition-shadow hover:shadow-level-2"
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-6 w-6 text-on-surface-variant/40" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body-md font-medium text-on-surface">{product.name}</p>
        <p className="text-label-sm text-on-surface-variant">Ref: {product.sku}</p>
      </div>

      <div className="flex items-center gap-1.5 text-label-md">
        <span className={cn("h-2 w-2 rounded-full", low ? "bg-error" : "bg-[#3ba55c]")} />
        <span className={low ? "text-error" : "text-on-surface-variant"}>
          {product.stock} un
        </span>
      </div>

      <p className="w-28 text-right text-body-md font-semibold text-primary">
        {formatBRL(product.priceCents)}
      </p>

      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary"
      >
        {canManage ? (
          <Pencil className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <Eye className="h-4 w-4" strokeWidth={1.75} />
        )}
      </span>
    </button>
  );
}
