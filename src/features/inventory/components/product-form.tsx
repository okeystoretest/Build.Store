"use client";

import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, ImageIcon, Plus, X } from "lucide-react";
import type { Product, GradeItem } from "@/types/domain";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/features/inventory/types/product-schema";
import { reaisToCents } from "@/lib/utils/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (values: Partial<Product>) => void;
  onCancel: () => void;
}

/** Normaliza a grade vinda de um produto existente para o formulário. */
function initialGrade(
  product?: Product | null,
): { color: string; size: string; quantity: number }[] {
  if (product?.grade && product.grade.length > 0) {
    return product.grade.map((g) => ({
      color: g.color ?? "",
      size: g.size ?? "",
      // Produtos antigos podem não ter quantity na grade: cai para 0.
      quantity: g.quantity ?? 0,
    }));
  }
  // Compatibilidade com produtos antigos (color/size únicos): joga todo o
  // estoque atual na primeira (e única) variação.
  if (product?.color || product?.size) {
    return [
      { color: product.color ?? "", size: product.size ?? "", quantity: product.stock ?? 0 },
    ];
  }
  return [{ color: "", size: "", quantity: 0 }];
}

/**
 * Create/edit product form. O preço de custo foi removido. A grade de peças é
 * dinâmica: o botão "+" adiciona novos pares Cor/Tamanho, e cada par pode ser
 * removido. SKU é exibido como "Referência". A imagem é salva como data URL
 * localmente (Supabase Storage assume em produção).
 */
export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.imageUrl ?? null,
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? "",
          priceReais: product.priceCents / 100,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          grade: initialGrade(product),
        }
      : {
          lowStockThreshold: 5,
          priceReais: 0,
          grade: [{ color: "", size: "", quantity: 0 }],
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "grade" });

  // Estoque total = soma das quantidades da grade, recalculado ao vivo.
  const watchedGrade = useWatch({ control, name: "grade" });
  const totalStock = (watchedGrade ?? []).reduce(
    (sum, g) => sum + (Number(g?.quantity) || 0),
    0,
  );

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (values: ProductFormValues) => {
    // Normaliza para GradeItem[], preservando a quantidade de cada variação.
    // Mantém itens com cor, tamanho OU quantidade informada (descarta só os
    // totalmente vazios).
    const grade: GradeItem[] = (values.grade ?? [])
      .map((g) => ({
        color: g.color?.trim() ? g.color.trim() : null,
        size: g.size?.trim() ? g.size.trim() : null,
        quantity: Number(g.quantity) || 0,
      }))
      .filter((g) => g.color !== null || g.size !== null || g.quantity > 0);

    // Estoque total = soma das quantidades da grade (fonte única de verdade).
    const stock = grade.reduce((sum, g) => sum + g.quantity, 0);

    onSubmit({
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || null,
      category: product?.category ?? "outros",
      // Preço de custo removido do formulário — preserva o existente ou zera.
      costCents: product?.costCents ?? 0,
      priceCents: reaisToCents(values.priceReais),
      unit: "unidade",
      stock,
      lowStockThreshold: values.lowStockThreshold,
      grade,
      // Legado: mantém color/size do primeiro item para compatibilidade.
      color: grade[0]?.color ?? null,
      size: grade[0]?.size ?? null,
      imageUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-md">
      <div className="space-y-1.5">
        <Label>Imagem do produto</Label>
        <div className="flex items-center gap-md">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-surface-container">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Prévia" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-on-surface-variant/40" strokeWidth={1.5} />
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-primary-container px-5 py-3 text-label-md text-primary transition-colors hover:bg-primary-fixed/40">
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
      </div>

      <Field label="Nome do produto" error={errors.name?.message}>
        <Input {...register("name")} placeholder="Ex.: Vela Artesanal Lavanda" />
      </Field>

      <div className="grid grid-cols-2 gap-md">
        <Field label="Referência" error={errors.sku?.message}>
          <Input {...register("sku")} placeholder="VEL-0012" />
        </Field>
        <Field label="Código de barras" error={errors.barcode?.message}>
          <Input {...register("barcode")} placeholder="789..." />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <Field label="Preço de venda (R$)" error={errors.priceReais?.message}>
          <Input type="number" step="0.01" {...register("priceReais", { valueAsNumber: true })} />
        </Field>
        <Field label="Estoque total">
          {/* Somatório automático das quantidades da grade (somente leitura). */}
          <Input
            type="number"
            value={totalStock}
            readOnly
            tabIndex={-1}
            aria-describedby="estoque-total-hint"
            className="cursor-default bg-surface-container text-on-surface-variant"
          />
          <p id="estoque-total-hint" className="px-2 text-label-sm text-on-surface-variant">
            Soma das quantidades da grade
          </p>
        </Field>
      </div>

      <Field label="Alerta em" error={errors.lowStockThreshold?.message}>
        <Input type="number" {...register("lowStockThreshold", { valueAsNumber: true })} />
      </Field>

      {/* Grade de peças — dinâmica */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <Label>Grade de peças</Label>
          <button
            type="button"
            onClick={() => append({ color: "", size: "", quantity: 0 })}
            className="flex items-center gap-1.5 rounded-full border border-primary-container px-3 py-1.5 text-label-md text-primary transition-colors hover:bg-primary-fixed/40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Adicionar
          </button>
        </div>

        <div className="space-y-sm">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-sm">
              <div className="flex-1 space-y-1.5">
                <Label>Cor</Label>
                <Input {...register(`grade.${index}.color`)} placeholder="Ex.: Rosa" />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>Tamanho</Label>
                <Input {...register(`grade.${index}.size`)} placeholder="Ex.: M" />
              </div>
              <div className="w-24 space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  {...register(`grade.${index}.quantity`, { valueAsNumber: true })}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label="Remover item da grade"
                className="mb-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-30"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-sm pt-sm">
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
