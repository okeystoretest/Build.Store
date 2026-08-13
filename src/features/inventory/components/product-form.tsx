"use client";

import { useState } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, ImageIcon, Plus, X, Trash2 } from "lucide-react";
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
import { uploadFile, type UploadProgress } from "@/lib/utils/upload-file";
import { UploadProgressBar } from "@/components/ui/upload-progress";

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (values: Partial<Product>) => void;
  onCancel: () => void;
  /** Quando presente (Admin em edição), exibe "Excluir" na barra de ações. */
  onDelete?: () => void;
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
 * Formulário de criar/editar produto — reestruturado para melhor ergonomia e
 * para caber sem rolagem:
 *  - Dados básicos no topo, distribuídos numa grade compacta (inputs h-9).
 *  - GRADE DE PEÇAS na extremidade inferior, em tabela quadrada
 *    (Nome / Cor / 36 / 38 / 40). O estoque total é a soma automática.
 *  - Barra de ações única e horizontal: Excluir à esquerda, Cancelar + Salvar
 *    à direita, no mesmo alinhamento.
 */
export function ProductForm({ product, onSubmit, onCancel, onDelete }: ProductFormProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.imageUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

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

  /** Sobe a imagem para o disco (/api/upload) e guarda só a URL no produto. */
  const handleImage = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setProgress({ loaded: 0, total: file.size, percent: 0, phase: "enviando" });
    try {
      const { url } = await uploadFile(file, "products", {
        onProgress: setProgress,
      });
      setImageUrl(url);
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "Falha ao enviar a imagem.",
      );
      setProgress(null);
    } finally {
      setUploading(false);
    }
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
      {/* Bloco superior: imagem + dados básicos numa grade compacta. */}
      <div className="flex items-start gap-md">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md bg-surface-container">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Prévia" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-7 w-7 text-on-surface-variant/40" strokeWidth={1.5} />
            )}
          </div>
          <label
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-primary-container px-3 py-1.5 text-label-sm text-primary transition-colors hover:bg-primary-fixed/40 aria-disabled:pointer-events-none aria-disabled:opacity-60"
            aria-disabled={uploading}
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
            {uploading ? "Enviando..." : "Imagem"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                void handleImage(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <UploadProgressBar
            progress={uploading ? progress : null}
            error={uploadError}
            className="w-20"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-sm">
          <Field label="Nome do produto" error={errors.name?.message}>
            <Input {...register("name")} placeholder="Ex.: Sandália Rasteira" className="h-9" />
          </Field>

          <div className="grid grid-cols-2 gap-sm">
            <Field label="Referência" error={errors.sku?.message}>
              <Input {...register("sku")} placeholder="SAN-0012" className="h-9" />
            </Field>
            <Field label="Código de barras" error={errors.barcode?.message}>
              <Input {...register("barcode")} placeholder="789..." className="h-9" />
            </Field>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <Field label="Preço (R$)" error={errors.priceReais?.message}>
          <Input type="number" step="0.01" className="h-9" {...register("priceReais", { valueAsNumber: true })} />
        </Field>
        <Field label="Alerta em" error={errors.lowStockThreshold?.message}>
          <Input type="number" className="h-9" {...register("lowStockThreshold", { valueAsNumber: true })} />
        </Field>
        <Field label="Estoque">
          <Input
            type="number"
            value={totalStock}
            readOnly
            tabIndex={-1}
            className="h-9 cursor-default bg-surface-container text-center text-on-surface-variant"
          />
        </Field>
      </div>

      {product?.address?.trim() && (
        <div className="space-y-1.5">
          <Label>Endereço do Produto</Label>
          <Input
            value={product.address}
            readOnly
            tabIndex={-1}
            className="h-9 cursor-default bg-surface-container text-on-surface-variant"
          />
          <p className="px-2 text-label-sm text-on-surface-variant">
            Editável por Lojista e Vendedora na visualização do produto.
          </p>
        </div>
      )}

      {/* Grade de peças — extremidade inferior. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Grade de peças</Label>
          <button
            type="button"
            onClick={() => append(emptyRow())}
            className="flex items-center gap-1.5 rounded-full border border-primary-container px-3 py-1.5 text-label-sm text-primary transition-colors hover:bg-primary-fixed/40"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Cor
          </button>
        </div>

        <div className="overflow-x-auto border border-outline-variant/60 scrollbar-slim">
          <table className="w-full min-w-[26rem] border-collapse text-body-md">
            <thead>
              <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
                <th className="border-r border-outline-variant/40 px-2 py-1.5 text-left font-medium">
                  Nome
                </th>
                <th className="border-r border-outline-variant/40 px-2 py-1.5 text-left font-medium">
                  Cor
                </th>
                {GRADE_SIZES.map((s) => (
                  <th
                    key={s}
                    className="w-14 border-r border-outline-variant/40 px-1 py-1.5 text-center font-medium last:border-r-0"
                  >
                    {s}
                  </th>
                ))}
                <th className="w-9 px-1 py-1.5" aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <tr key={field.id} className="border-t border-outline-variant/40">
                  <td className="max-w-[7rem] truncate border-r border-outline-variant/30 px-2 py-1 text-label-sm text-on-surface-variant">
                    {productName?.trim() ? productName : "—"}
                  </td>
                  <td className="border-r border-outline-variant/30 px-1 py-1">
                    <Input
                      {...register(`grade.${index}.color`)}
                      placeholder="Cor"
                      className="h-8 rounded-none border-0 bg-transparent px-1 focus:bg-surface"
                    />
                  </td>
                  {GRADE_SIZES.map((s) => (
                    <td
                      key={s}
                      className="border-r border-outline-variant/30 px-0.5 py-1 last:border-r-0"
                    >
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        aria-label={`Linha ${index + 1}, tamanho ${s}`}
                        className="h-8 rounded-none border-0 bg-transparent px-1 text-center focus:bg-surface"
                        {...register(`grade.${index}.sizes.${s}`, {
                          valueAsNumber: true,
                        })}
                      />
                    </td>
                  ))}
                  <td className="px-0.5 py-1 text-center">
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

      {/* Barra de ações: Excluir à esquerda, Cancelar + Salvar à direita. */}
      <div className="flex items-center gap-sm border-t border-outline-variant/40 pt-md">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 rounded-full border border-error/40 px-5 py-2.5 text-label-md text-error transition-colors hover:bg-error-container hover:text-on-error-container"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Excluir produto
          </button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex gap-sm">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {product ? "Salvar alterações" : "Adicionar produto"}
          </Button>
        </div>
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
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="px-2 text-label-sm text-error">{error}</p>}
    </div>
  );
}
