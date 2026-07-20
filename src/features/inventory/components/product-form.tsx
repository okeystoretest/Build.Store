"use client";

import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, ImageIcon, Plus, X } from "lucide-react";
import type { Product, GradeItem } from "@/types/domain";
import { GRADE_SIZES } from "@/types/domain";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/features/inventory/types/product-schema";
import { reaisToCents } from "@/lib/utils/money";
import { gradeTotal, normalizeGrade } from "@/lib/db/grade";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (values: Partial<Product>) => void;
  onCancel: () => void;
}

/** Linha vazia da tabela de grade (cor + quantidades zeradas por tamanho). */
function emptyRow(): { color: string; sizes: Record<string, number> } {
  const sizes: Record<string, number> = {};
  for (const s of GRADE_SIZES) sizes[s] = 0;
  return { color: "", sizes };
}

/** Normaliza a grade de um produto existente para o formulário. */
function initialGrade(
  product?: Product | null,
): { color: string; sizes: Record<string, number> }[] {
  if (product?.grade && product.grade.length > 0) {
    return product.grade.map((g) => {
      const sizes: Record<string, number> = {};
      for (const s of GRADE_SIZES) sizes[s] = Number(g.sizes?.[s]) || 0;
      return { color: g.color ?? "", sizes };
    });
  }
  return [emptyRow()];
}

/**
 * Formulário de criar/editar produto — layout HORIZONTAL (wide) para caber sem
 * rolagem: coluna da esquerda com imagem + dados básicos, coluna da direita com
 * a grade em tabela quadrada (Nome / Cor / 36 / 38 / 40). O estoque total é a
 * soma automática das células.
 */
export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.imageUrl ?? null,
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? "",
          priceReais: product.priceCents / 100,
          lowStockThreshold: product.lowStockThreshold,
          grade: initialGrade(product),
        }
      : {
          lowStockThreshold: 5,
          priceReais: 0,
          grade: [emptyRow()],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "grade" });
  const productName = watch("name");

  const watchedGrade = useWatch({ control, name: "grade" });
  const totalStock = gradeTotal(
    (watchedGrade ?? []).map((r) => ({
      color: r?.color ?? null,
      sizes: r?.sizes ?? {},
    })),
  );

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (values: ProductFormValues) => {
    const grade: GradeItem[] = normalizeGrade(
      (values.grade ?? []).map((r) => ({
        color: r.color ?? null,
        sizes: r.sizes ?? {},
      })),
    );
    const stock = gradeTotal(grade);

    onSubmit({
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || null,
      category: product?.category ?? "outros",
      costCents: product?.costCents ?? 0,
      priceCents: reaisToCents(values.priceReais),
      unit: "unidade",
      stock,
      lowStockThreshold: values.lowStockThreshold,
      grade,
      color: grade[0]?.color ?? null,
      size: GRADE_SIZES[0],
      imageUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-md">
      <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
        {/* Coluna esquerda: imagem + dados básicos */}
        <div className="space-y-md">
          <div className="flex items-center gap-md">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="Prévia" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-on-surface-variant/40" strokeWidth={1.5} />
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-primary-container px-4 py-2.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40">
              <Upload className="h-4 w-4" strokeWidth={1.75} />
              Enviar imagem
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImage(e.target.files?.[0])}
              />
            </label>
          </div>

          <Field label="Nome do produto" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Ex.: Sandália Rasteira" />
          </Field>

          {product?.address?.trim() && (
            <div className="space-y-1.5">
              <Label>Endereço do Produto</Label>
              <Input
                value={product.address}
                readOnly
                tabIndex={-1}
                className="cursor-default bg-surface-container text-on-surface-variant"
              />
              <p className="px-2 text-label-sm text-on-surface-variant">
                Editável por Lojista e Vendedora na visualização do produto.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-md">
            <Field label="Referência" error={errors.sku?.message}>
              <Input {...register("sku")} placeholder="SAN-0012" />
            </Field>
            <Field label="Código de barras" error={errors.barcode?.message}>
              <Input {...register("barcode")} placeholder="789..." />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-md sm:grid-cols-3">
            <Field label="Preço (R$)" error={errors.priceReais?.message}>
              <Input type="number" step="0.01" {...register("priceReais", { valueAsNumber: true })} />
            </Field>
            <Field label="Alerta em" error={errors.lowStockThreshold?.message}>
              <Input type="number" {...register("lowStockThreshold", { valueAsNumber: true })} />
            </Field>
            <Field label="Estoque">
              <Input
                type="number"
                value={totalStock}
                readOnly
                tabIndex={-1}
                className="cursor-default bg-surface-container text-center text-on-surface-variant"
              />
            </Field>
          </div>
        </div>

        {/* Coluna direita: grade em tabela quadrada */}
        <div className="space-y-sm">
          <div className="flex items-center justify-between">
            <Label>Grade de peças</Label>
            <button
              type="button"
              onClick={() => append(emptyRow())}
              className="flex items-center gap-1.5 rounded-full border border-primary-container px-3 py-1.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Cor
            </button>
          </div>

          <div className="overflow-x-auto border border-outline-variant/60 scrollbar-slim">
            <table className="w-full min-w-[26rem] border-collapse text-body-md">
              <thead>
                <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
                  <th className="border-r border-outline-variant/40 px-2 py-2 text-left font-medium">
                    Nome
                  </th>
                  <th className="border-r border-outline-variant/40 px-2 py-2 text-left font-medium">
                    Cor
                  </th>
                  {GRADE_SIZES.map((s) => (
                    <th
                      key={s}
                      className="w-14 border-r border-outline-variant/40 px-1 py-2 text-center font-medium last:border-r-0"
                    >
                      {s}
                    </th>
                  ))}
                  <th className="w-9 px-1 py-2" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-t border-outline-variant/40">
                    <td className="max-w-[7rem] truncate border-r border-outline-variant/30 px-2 py-1.5 text-label-sm text-on-surface-variant">
                      {productName?.trim() ? productName : "—"}
                    </td>
                    <td className="border-r border-outline-variant/30 px-1 py-1.5">
                      <Input
                        {...register(`grade.${index}.color`)}
                        placeholder="Cor"
                        className="h-9 rounded-none border-0 bg-transparent px-1 focus:bg-surface"
                      />
                    </td>
                    {GRADE_SIZES.map((s) => (
                      <td
                        key={s}
                        className="border-r border-outline-variant/30 px-0.5 py-1.5 last:border-r-0"
                      >
                        <Input
                          type="number"
                          min={0}
                          placeholder="0"
                          aria-label={`Linha ${index + 1}, tamanho ${s}`}
                          className="h-9 rounded-none border-0 bg-transparent px-1 text-center focus:bg-surface"
                          {...register(`grade.${index}.sizes.${s}`, {
                            valueAsNumber: true,
                          })}
                        />
                      </td>
                    ))}
                    <td className="px-0.5 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        aria-label="Remover cor"
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <X className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.grade?.message && (
            <p className="px-2 text-label-sm text-error">{errors.grade.message}</p>
          )}
          <p className="px-1 text-label-sm text-on-surface-variant">
            Estoque total: <span className="font-semibold text-on-surface">{totalStock}</span> un
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-sm border-t border-outline-variant/40 pt-md">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {product ? "Salvar alterações" : "Adicionar produto"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="px-2 text-label-sm text-error">{error}</p>}
    </div>
  );
}
