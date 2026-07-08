"use client";

import { Plus, ImageIcon } from "lucide-react";
import type { Product } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";

interface ProductResultsProps {
  products: Product[];
  query: string;
  onSelect: (product: Product) => void;
}

/**
 * Horizontal results strip. Only rendered while the operator is searching, so
 * the cart keeps full height during normal scanning. Tapping a card adds it.
 */
export function ProductResults({
  products,
  query,
  onSelect,
}: ProductResultsProps) {
  if (!query.trim()) return null;

  if (products.length === 0) {
    return (
      <div className="border-b border-outline-variant/50 px-margin py-md">
        <p className="text-body-md text-on-surface-variant">
          Nenhum produto encontrado para “{query}”.
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-outline-variant/50 px-margin py-md">
      <div className="flex gap-sm overflow-x-auto pb-2">
        {products.map((p) => {
          const outOfStock = p.stock <= 0;
          return (
            <button
              key={p.id}
              onClick={() => !outOfStock && onSelect(p)}
              disabled={outOfStock}
              aria-disabled={outOfStock}
              className={`group flex w-40 shrink-0 flex-col rounded-md bg-surface-container-lowest p-sm text-left shadow-level-1 transition-colors ${
                outOfStock
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-primary-fixed/30"
              }`}
            >
              <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-sm bg-surface-container">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon
                    className="h-7 w-7 text-on-surface-variant/40"
                    strokeWidth={1.5}
                  />
                )}
                {outOfStock && (
                  <span className="absolute inset-x-0 bottom-0 bg-error/90 py-0.5 text-center text-label-sm font-semibold text-on-error">
                    Esgotado
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-label-md text-on-surface">
                {p.name}
              </p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-body-md font-semibold text-primary">
                  {formatBRL(p.priceCents)}
                </span>
                {!outOfStock && (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-primary transition-colors group-hover:bg-primary-container">
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
