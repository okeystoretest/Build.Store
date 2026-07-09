import { z } from "zod";
import { GRADE_SIZES } from "@/types/domain";

/**
 * Validação do formulário de produto. A grade de peças é uma tabela: cada linha
 * é uma cor com a quantidade de cada tamanho fixo (36/38/40). O estoque total é
 * derivado da soma dessas quantidades (não é digitado).
 */

// Objeto de quantidades por tamanho: { "36": n, "38": n, "40": n }.
const sizesShape = Object.fromEntries(
  GRADE_SIZES.map((s) => [
    s,
    z
      .number({ invalid_type_error: "Informe um número" })
      .int("Use um número inteiro")
      .min(0, "Não pode ser negativo")
      .default(0),
  ]),
);

export const gradeRowSchema = z.object({
  color: z.string().optional(),
  sizes: z.object(sizesShape),
});

export const productFormSchema = z.object({
  name: z.string().min(2, "Informe o nome do produto"),
  sku: z.string().min(1, "Informe a referência"),
  barcode: z.string().optional(),
  priceReais: z
    .number({ invalid_type_error: "Informe o preço de venda" })
    .min(0, "Não pode ser negativo"),
  lowStockThreshold: z
    .number({ invalid_type_error: "Informe o limite" })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo"),
  grade: z.array(gradeRowSchema).min(1, "Adicione ao menos uma cor"),
  imageUrl: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
