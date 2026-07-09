import { createClient } from "@/lib/supabase/client";
import { NOTIFICATION_COLUMNS, toNotification } from "@/lib/db/mappers";
import type { AppNotification, Product } from "@/types/domain";

/**
 * Notification repository — online-only. Alimenta o menu do sino direto do
 * Supabase (tabela `notifications`, global). Realtime nos hooks mantém o sino
 * atualizado entre dispositivos.
 */

export async function listNotifications(): Promise<AppNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toNotification);
}

export async function unreadCount(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw error;
}

/** Remove todas as notificações. */
export async function clearNotifications(): Promise<void> {
  const supabase = createClient();
  // Delete-all exige um filtro; created_at sempre existe.
  const { error } = await supabase
    .from("notifications")
    .delete()
    .not("created_at", "is", null);
  if (error) throw error;
}

/**
 * Emite a notificação de "novo produto". Por spec, disparada quando um Admin
 * adiciona um produto; carrega Referência (sku), Nome e Quantidade.
 */
export async function notifyProductAdded(product: Product): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").insert({
    kind: "product_added",
    title: "Novo produto no estoque",
    body: `Ref. ${product.sku} · ${product.name} · ${product.stock} un`,
    read: false,
  });
  if (error) throw error;
}
