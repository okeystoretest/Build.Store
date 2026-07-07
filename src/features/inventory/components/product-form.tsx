"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, ImageIcon } from "lucide-react";
import type { Product } from "@/types/domain";
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

/**
 * Create/edit product form. Category and unit removed (unit is always
 * "unidade"). SKU shown as "Referência". Includes an image upload that stores
 * the picture as a data URL locally (Supabase Storage takes over in production).
 */
export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.imageUrl ?? null,
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode ?? "",
          costReais: product.costCents / 100,
          priceReais: product.priceCents / 100,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
        }
      : {
          stock: 0,
          lowStockThreshold: 5,
          costReais: 0,
          priceReais: 0,
        },
  });

  const handleImage = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (values: ProductFormValues) => {
    onSubmit({
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || null,
      category: product?.category ?? "outros",
      costCents: reaisToCents(values.costReais),
      priceCents: reaisToCents(values.priceReais),
      unit: "unidade",
      stock: values.stock,
      lowStockThreshold: values.lowStockThreshold,
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
        <Field label="Preço de custo (R$)" error={errors.costReais?.message}>
          <Input type="number" step="0.01" {...register("costReais", { valueAsNumber: true })} />
        </Field>
        <Field label="Preço de venda (R$)" error={errors.priceReais?.message}>
          <Input type="number" step="0.01" {...register("priceReais", { valueAsNumber: true })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <Field label="Estoque" error={errors.stock?.message}>
          <Input type="number" {...register("stock", { valueAsNumber: true })} />
        </Field>
        <Field label="Alerta em" error={errors.lowStockThreshold?.message}>
          <Input type="number" {...register("lowStockThreshold", { valueAsNumber: true })} />
        </Field>
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
