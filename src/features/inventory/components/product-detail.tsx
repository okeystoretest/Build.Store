"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon, MapPin, Save } from "lucide-react";
import type { Product } from "@/types/domain";
import { GRADE_SIZES } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { gradeTotal, variationQty } from "@/lib/db/grade";
import { upsertProduct } from "@/lib/db/product-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Visualização de produto para Lojista/Vendedora.
 * Exibe imagem, referência, nome, preço e a grade de peças como tabela
 * (Nome / Cor / 36 / 38 / 40) com o estoque total.
 *
 * O campo "Endereço do Produto" é EDITÁVEL exclusivamente por Lojista e
 * Vendedora (endereçamento físico no estoque, ex.: prateleira/gaveta).
 */
export function ProductDetail({ product }: { product: Product }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();
  // Somente Lojista e Vendedora podem editar o endereço do produto.
  const canEditAddress = role === "lojista" || role === "vendedora";

  const [address, setAddress] = useState(product.address ?? "");
  const [saving, setSaving] = useState(false);

  // Reseta o campo ao trocar de produto.
  useEffect(() => {
    setAddress(product.address ?? "");
  }, [product.id, product.address]);

  const dirty = (address.trim() || null) !== (product.address ?? null);

  const saveAddress = async () => {
    setSaving(true);
    try {
      await upsertProduct({ ...product, address: address.trim() || null });
      await queryClient.invalidateQueries({ queryKey: queryKeys.products });
      toast.success("Endereço do produto atualizado.");
    } catch {
      toast.error("Não foi possível salvar o endereço.");
    } finally {
      setSaving(false);
    }
  };

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

      {/* Endereço do produto — editável por Lojista/Vendedora. */}
      <div className="rounded-lg border border-primary-container/40 bg-surface-container-low px-md py-md">
        <div className="mb-2 flex items-center gap-2 text-on-surface">
          <MapPin className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <Label>Endereço do Produto</Label>
        </div>
        {canEditAddress ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ex.: Prateleira A3 · Gaveta 2"
              aria-label="Endereço do produto no estoque"
              className="flex-1"
            />
            <Button onClick={saveAddress} disabled={saving || !dirty}>
              <Save className="h-4 w-4" strokeWidth={1.75} />
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        ) : (
          <p className="text-body-md text-on-surface">
            {product.address?.trim() ? product.address : "—"}
          </p>
        )}
        <p className="mt-1.5 px-1 text-label-sm text-on-surface-variant">
          Localização física da peça no estoque.
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
      <div className="overflow-x-auto border border-outline-variant/50">
        <table className="w-full border-collapse text-body-md">
          <thead>
            <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
              <th className="border-r border-outline-variant/40 px-3 py-2 text-left font-medium">Nome</th>
              <th className="border-r border-outline-variant/40 px-3 py-2 text-left font-medium">Cor</th>
              {GRADE_SIZES.map((s) => (
                <th
                  key={s}
                  className="w-14 border-r border-outline-variant/40 px-2 py-2 text-center font-medium last:border-r-0"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.map((row, i) => (
              <tr key={i} className="border-t border-outline-variant/40">
                <td className="border-r border-outline-variant/30 px-3 py-2 text-on-surface-variant">{product.name}</td>
                <td className="border-r border-outline-variant/30 px-3 py-2 text-on-surface">{row.color ?? "—"}</td>
                {GRADE_SIZES.map((s) => {
                  const qty = variationQty(row, s);
                  return (
                    <td
                      key={s}
                      className={
                        "border-r border-outline-variant/30 px-2 py-2 text-center last:border-r-0 " +
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
