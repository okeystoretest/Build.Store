import { z } from "zod";

/**
 * Product form validation. Category and unit were removed per spec (unit
 * defaults to "unidade"). SKU is surfaced as "Referência" in the UI. Prices are
 * entered in reais and converted to centavos on submit.
 */
export const productFormSchema = z.object({
  name: z.string().min(2, "Informe o nome do produto"),
  sku: z.string().min(1, "Informe a referência"),
  barcode: z.string().optional(),
  costReais: z
    .number({ invalid_type_error: "Informe o preço de custo" })
    .min(0, "Não pode ser negativo"),
  priceReais: z
    .number({ invalid_type_error: "Informe o preço de venda" })
    .min(0, "Não pode ser negativo"),
  stock: z
    .number({ invalid_type_error: "Informe a quantidade" })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo"),
  lowStockThreshold: z
    .number({ invalid_type_error: "Informe o limite" })
    .int("Use um número inteiro")
    .min(0, "Não pode ser negativo"),
  color: z.string().optional(),
  size: z.string().optional(),
  imageUrl: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
