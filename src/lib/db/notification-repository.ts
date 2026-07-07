import { db } from "@/lib/db/dexie";
import type { AppNotification, Product } from "@/types/domain";

/**
 * Notification repository. Backs the bell menu. In production these would fan
 * out via Supabase Realtime; locally they live in Dexie so the flow is
 * exercised offline.
 */

export async function listNotifications(): Promise<AppNotification[]> {
  return db.notifications.orderBy("createdAt").reverse().toArray();
}

export async function unreadCount(): Promise<number> {
  const all = await db.notifications.toArray();
  return all.filter((n) => !n.read).length;
}

export async function markAllRead(): Promise<void> {
  const all = await db.notifications.toArray();
  await Promise.all(
    all.filter((n) => !n.read).map((n) => db.notifications.update(n.id, { read: true })),
  );
}

/**
 * Emit the "new product" notification. Per spec, fired when an Admin adds a
 * product; carries Referência (sku), Nome and Quantidade.
 */
export async function notifyProductAdded(product: Product): Promise<void> {
  const note: AppNotification = {
    id: crypto.randomUUID(),
    kind: "product_added",
    title: "Novo produto no estoque",
    body: `Ref. ${product.sku} · ${product.name} · ${product.stock} un`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  await db.notifications.put(note);
}
