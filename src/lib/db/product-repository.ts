import { createClient } from "@/lib/supabase/client";
import { PRODUCT_COLUMNS, toProduct, productToRow } from "@/lib/db/mappers";
import type { Product, StockMovement } from "@/types/domain";

/**
 * Product repository — online-only.
 *
 * O Supabase é a única fonte de verdade. Toda leitura/escrita vai direto ao
 * banco. O estoque é decrementado EXCLUSIVAMENTE pelo servidor: a função
 * applyStockMovement insere uma linha em `stock_movements` e o gatilho SQL
 * (apply_stock_movement) ajusta products.stock atomicamente. Nada de estoque é
 * calculado no cliente.
 */

export async function listProducts(): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toProduct);
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : undefined;
}

/** Cria ou atualiza um produto (upsert idempotente pelo id). */
export async function upsertProduct(product: Product): Promise<void> {
  const supabase = createClient();
  const row = productToRow({ ...product, updatedAt: new Date().toISOString() });
  const { error } = await supabase.from("products").upsert(row);
  if (error) throw error;
}

/** Remove um produto do estoque (somente Admin, controlado na UI). */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Registra um movimento de estoque. O gatilho do banco aplica o delta em
 * products.stock — o cliente NÃO altera o estoque diretamente. Usado por
 * ajustes manuais de inventário (entrada, perda, avaria). Vendas registram
 * seus próprios movimentos dentro de recordSale.
 */
export async function applyStockMovement(
  movement: Omit<StockMovement, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  },
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: movement.productId,
    delta: movement.delta,
    reason: movement.reason,
    order_id: movement.orderId ?? null,
    note: movement.note ?? null,
  });
  if (error) throw error;
}
