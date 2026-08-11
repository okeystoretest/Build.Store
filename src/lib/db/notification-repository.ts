import { createClient } from "@/lib/supabase/client";
import { NOTIFICATION_COLUMNS, toNotification } from "@/lib/db/mappers";
import type { AppNotification, Product } from "@/types/domain";

/**
 * Notification repository — online-only, por loja. O sino é escopado pela loja
 * ativa (própria loja, ou a selecionada pelo admin). Realtime nos hooks mantém
 * o sino atualizado entre dispositivos.
 *
 * Nas leituras, `storeId` filtra por loja quando presente (narrowing do admin);
 * a RLS já restringe não-admins à própria loja.
 */

export async function listNotifications(
  storeId?: string | null,
): Promise<AppNotification[]> {
  const supabase = createClient();
  let q = supabase.from("notifications").select(NOTIFICATION_COLUMNS);
  if (storeId) q = q.eq("store_id", storeId);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNotification);
}

export async function unreadCount(storeId?: string | null): Promise<number> {
  const supabase = createClient();
  let q = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (storeId) q = q.eq("store_id", storeId);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(storeId?: string | null): Promise<void> {
  const supabase = createClient();
  let q = supabase.from("notifications").update({ read: true }).eq("read", false);
  if (storeId) q = q.eq("store_id", storeId);
  const { error } = await q;
  if (error) throw error;
}

/** Remove todas as notificações (da loja ativa, quando informada). */
export async function clearNotifications(
  storeId?: string | null,
): Promise<void> {
  const supabase = createClient();
  // Delete-all exige um filtro; created_at sempre existe.
  let q = supabase.from("notifications").delete().not("created_at", "is", null);
  if (storeId) q = q.eq("store_id", storeId);
  const { error } = await q;
  if (error) throw error;
}

/**
 * Emite a notificação de "novo produto". Por spec, disparada quando um Admin
 * adiciona um produto; carrega Referência (sku), Nome e Quantidade. Carimba a
 * loja para o sino da loja certa receber.
 */
export async function notifyProductAdded(
  product: Product,
  storeId: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").insert({
    kind: "product_added",
    title: "Novo produto no estoque",
    body: `Ref. ${product.sku} · ${product.name} · ${product.stock} un`,
    read: false,
    store_id: storeId,
  });
  if (error) throw error;
}
