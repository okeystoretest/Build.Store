"use client";

import { ImageIcon } from "lucide-react";
import type { Product } from "@/types/domain";
import { GRADE_SIZES } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { gradeTotal, variationQty } from "@/lib/db/grade";

/**
 * Visualização de produto (somente leitura) para Lojista/Vendedora.
 * Exibe imagem, referência, nome, preço e a grade de peças como tabela
 * (Nome / Cor / 36 / 38 / 40) com o estoque total.
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
        <GradeTable product={product} />
      </div>
    </div>
  );
}

/** Tabela da grade (cor × tamanho) com totais. */
function GradeTable({ product }: { product: Product }) {
  const grade = product.grade ?? [];

  if (grade.length === 0) {
    return <p className="text-body-md text-on-surface-variant">—</p>;
  }

  const total = gradeTotal(grade);

  return (
    <div className="space-y-sm">
      <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
        <table className="w-full border-collapse text-body-md">
          <thead>
            <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="px-3 py-2 text-left font-medium">Nome</th>
              <th className="px-3 py-2 text-left font-medium">Cor</th>
              {GRADE_SIZES.map((s) => (
                <th key={s} className="w-14 px-2 py-2 text-center font-medium">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((row, i) => (
              <tr key={i} className="border-t border-outline-variant/40">
                <td className="px-3 py-2 text-on-surface-variant">{product.name}</td>
                <td className="px-3 py-2 text-on-surface">{row.color ?? "—"}</td>
                {GRADE_SIZES.map((s) => {
                  const qty = variationQty(row, s);
                  return (
                    <td
                      key={s}
                      className={
                        "px-2 py-2 text-center " +
                        (qty === 0 ? "text-on-surface-variant/40" : "text-on-surface")
                      }
                    >
                      {qty}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-label-md text-on-surface-variant">
        Estoque total: <span className="font-semibold text-on-surface">{total}</span> un
      </p>
    </div>
  );
}
