import { createClient } from "@/lib/supabase/client";
import { PRODUCT_COLUMNS, toProduct, productToRow } from "@/lib/db/mappers";
import type { Product, StockMovement } from "@/types/domain";


export async function listProducts(storeId?: string | null): Promise<Product[]> {
  const supabase = createClient();
  let q = supabase.from("products").select(PRODUCT_COLUMNS);
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q.order("name", { ascending: true });
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
export async function upsertProduct(
  product: Product,
  storeId: string,
): Promise<void> {
  const supabase = createClient();
  const row = productToRow({ ...product, updatedAt: new Date().toISOString() });
  const { error } = await supabase
    .from("products")
    .upsert({ ...row, store_id: storeId });
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
  storeId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: movement.productId,
    delta: movement.delta,
    reason: movement.reason,
    order_id: movement.orderId ?? null,
    note: movement.note ?? null,
    store_id: storeId,
  });
  if (error) throw error;
}
