import { db } from "@/lib/db/dexie";
import { transport, isSupabaseConfigured } from "@/lib/sync/transport";
import type { Order } from "@/types/domain";

/**
 * Sync engine. Flushes locally-created orders (syncStatus="pending") through
 * the active transport and marks each synced on success, leaving failures
 * queued for the next attempt. Also pulls server state down into the local
 * Dexie mirror so any device sees the same products, orders, users, campaigns
 * and goals. Pure orchestration — the transport owns the wire format, the
 * repositories own persistence.
 */

export interface SyncResult {
  pushed: number;
  failed: number;
}

/** Orders awaiting upload, oldest first. */
export async function pendingOrders(): Promise<Order[]> {
  return db.orders.where("syncStatus").equals("pending").sortBy("createdAt");
}

export async function pendingCount(): Promise<number> {
  return db.orders.where("syncStatus").equals("pending").count();
}

/** Flush all pending orders. Safe to call repeatedly; idempotent per order. */
export async function flushPending(): Promise<SyncResult> {
  const pending = await pendingOrders();
  let pushed = 0;
  let failed = 0;

  for (const order of pending) {
    try {
      await transport.pushOrder(order);
      await db.orders.update(order.id, { syncStatus: "synced" });
      pushed += 1;
    } catch {
      await db.orders.update(order.id, { syncStatus: "error" });
      failed += 1;
    }
  }

  return { pushed, failed };
}

/**
 * Baixa o estado do servidor para o Dexie local. Roda no carregamento do app
 * (e quando a conexão volta), tornando o mesmo estoque, pedidos, usuários,
 * campanhas e metas visíveis em qualquer dispositivo.
 *
 * Regras de segurança:
 * - Só age com Supabase configurado (em modo local puro é um no-op).
 * - Preserva pedidos locais ainda NÃO sincronizados (syncStatus "pending"/
 *   "error"): eles não são apagados nem sobrescritos pela versão do servidor,
 *   para não perder vendas feitas offline que ainda não subiram.
 */
export async function pullAll(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (!isOnline()) return;

  const [products, orders, users, campaigns, goals] = await Promise.all([
    transport.pullProducts(null),
    transport.pullOrders(),
    transport.pullUsers(),
    transport.pullCampaigns(),
    transport.pullGoals(),
  ]);

  // Produtos: o servidor é a fonte autoritativa do catálogo/estoque. Antes de
  // substituir, protege produtos criados localmente que ainda não existem no
  // servidor (ex.: cadastrados offline) — tenta empurrá-los; os que subirem
  // voltam no próximo pull. Assim o clear() não descarta trabalho não salvo.
  const serverProductIds = new Set(products.map((p) => p.id));
  const localOnlyProducts = (await db.products.toArray()).filter(
    (p) => !serverProductIds.has(p.id),
  );
  for (const p of localOnlyProducts) {
    try {
      await transport.pushProduct(p);
    } catch {
      /* mantém localmente; tentaremos de novo no próximo ciclo */
    }
  }
  // Rebaixa o catálogo do servidor + quaisquer locais que não subiram, para não
  // perder cadastros offline enquanto o push não conclui.
  const stillLocalOnly = localOnlyProducts.filter(
    (p) => !serverProductIds.has(p.id),
  );
  await db.products.clear();
  if (products.length > 0) await db.products.bulkPut(products);
  if (stillLocalOnly.length > 0) await db.products.bulkPut(stillLocalOnly);

  // Usuários, campanhas e metas: idem — substitui pelo estado do servidor.
  await db.users.clear();
  if (users.length > 0) await db.users.bulkPut(users);

  await db.campaigns.clear();
  if (campaigns.length > 0) await db.campaigns.bulkPut(campaigns);

  await db.goals.clear();
  if (goals.length > 0) await db.goals.bulkPut(goals);

  // Pedidos: preserva os que ainda não subiram (pending/error). Remove só os
  // que já estavam sincronizados e regrava a versão do servidor por cima.
  const unsynced = await db.orders
    .where("syncStatus")
    .anyOf("pending", "error")
    .toArray();
  const unsyncedIds = new Set(unsynced.map((o) => o.id));

  const syncedLocalIds = (await db.orders.toArray())
    .filter((o) => !unsyncedIds.has(o.id))
    .map((o) => o.id);
  if (syncedLocalIds.length > 0) await db.orders.bulkDelete(syncedLocalIds);

  // Grava do servidor apenas os pedidos que não têm versão local pendente.
  const serverOrders = orders.filter((o) => !unsyncedIds.has(o.id));
  if (serverOrders.length > 0) await db.orders.bulkPut(serverOrders);
}

/** True when the browser reports connectivity. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
