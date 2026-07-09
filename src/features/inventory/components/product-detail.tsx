"use client";

import { ImageIcon } from "lucide-react";
import type { Product } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";

/**
 * Visualização de produto (somente leitura) para Lojista/Vendedora.
 * Exibe imagem, referência, nome, preço e a grade de peças (cor e tamanho).
 * Sem ações de edição/exclusão — essas são exclusivas do Admin.
 */
export function ProductDetail({ product }: { product: Product }) {
  return (
    <div className="space-y-md">
      <div className="flex h-56 w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-12 w-12 text-on-surface-variant/40" strokeWidth={1.5} />
        )}
      </div>

      <div>
        <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
          Ref: {product.sku}
        </p>
        <h3 className="mt-1 text-headline-md text-on-surface">{product.name}</h3>
        <p className="mt-1 text-headline-md text-primary">
          {formatBRL(product.priceCents)}
        </p>
      </div>

      <div>
        <p className="mb-sm text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
          Grade de peças
        </p>
        <GradeList product={product} />
      </div>
    </div>
  );
}

/**
 * Lista a grade (variações cor/tamanho/quantidade); cai no legado color/size se
 * necessário. Exibe também o total de peças (soma das quantidades).
 */
function GradeList({ product }: { product: Product }) {
  const grade =
    product.grade && product.grade.length > 0
      ? product.grade
      : product.color || product.size
        ? [{ color: product.color, size: product.size, quantity: product.stock }]
        : [];

  if (grade.length === 0) {
    return <p className="text-body-md text-on-surface-variant">—</p>;
  }

  const total = grade.reduce((sum, g) => sum + (Number(g.quantity) || 0), 0);

  return (
    <div className="space-y-sm">
      {grade.map((g, i) => (
        <div key={i} className="grid grid-cols-3 gap-sm">
          <div className="rounded-md bg-surface-container-low px-md py-sm">
            <p className="text-label-sm text-on-surface-variant">Cor</p>
            <p className="text-body-md text-on-surface">{g.color ?? "—"}</p>
          </div>
          <div className="rounded-md bg-surface-container-low px-md py-sm">
            <p className="text-label-sm text-on-surface-variant">Tamanho</p>
            <p className="text-body-md text-on-surface">{g.size ?? "—"}</p>
          </div>
          <div className="rounded-md bg-surface-container-low px-md py-sm">
            <p className="text-label-sm text-on-surface-variant">Qtd.</p>
            <p className="text-body-md text-on-surface">{g.quantity ?? 0}</p>
          </div>
        </div>
      ))}
      <p className="px-1 pt-1 text-label-md text-on-surface-variant">
        Estoque total: <span className="font-semibold text-on-surface">{total}</span> un
      </p>
    </div>
  );
}
