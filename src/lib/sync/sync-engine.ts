import { db } from "@/lib/db/dexie";
import { transport, isSupabaseConfigured } from "@/lib/sync/transport";
import { getReadySession } from "@/lib/sync/session";
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

  // GATE CRÍTICO: só sincroniza com uma sessão pronta (usuário autenticado COM
  // store_id resolvível). Sem isso, os pulls dependentes de RLS voltariam
  // vazios sem erro — e um clear() cego apagaria o Dexie. Este era o bug de
  // "dados somem em outro dispositivo / após Ctrl+F5": o pull rodava antes do
  // cookie de sessão propagar e limpava o espelho local com nada.
  const session = await getReadySession();
  if (!session) {
    console.warn(
      "[sync] pullAll adiado: sessão ainda não está pronta (sem store_id).",
    );
    return;
  }

  // Cada pull é resiliente: se um deles falhar, os demais ainda aplicam. Um
  // pull que falha vira `null` e NUNCA dispara clear() — preservamos o que já
  // existe localmente em vez de destruir dados por causa de uma falha de rede.
  // O nome do pull e o código/mensagem do Postgres são logados para que uma
  // falha em produção seja identificável (ex.: 42P17 recursão de RLS, 57014
  // timeout, 401/permission).
  const safe = async <T>(
    label: string,
    fn: () => Promise<T[]>,
  ): Promise<T[] | null> => {
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e as {
        code?: string;
        message?: string;
        details?: string;
        hint?: string;
      };
      console.error(
        `[sync] pull "${label}" falhou:`,
        JSON.stringify({
          code: err?.code ?? null,
          message: err?.message ?? String(e),
          details: err?.details ?? null,
          hint: err?.hint ?? null,
        }),
      );
      return null;
    }
  };

  const [products, orders, users, campaigns, goals] = await Promise.all([
    safe("products", () => transport.pullProducts(null)),
    safe("orders", () => transport.pullOrders()),
    safe("users", () => transport.pullUsers()),
    safe("campaigns", () => transport.pullCampaigns()),
    safe("goals", () => transport.pullGoals()),
  ]);

  // Produtos: o servidor é a fonte autoritativa do catálogo/estoque. Só
  // reconcilia se o pull teve sucesso (products !== null). Antes de substituir,
  // protege produtos criados localmente que ainda não existem no servidor
  // (cadastrados offline) — tenta empurrá-los; os que subirem voltam no próximo
  // pull. Assim o merge não descarta trabalho não salvo.
  if (products !== null) {
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
    // Substitui pelo estado do servidor + quaisquer locais que não subiram.
    await db.products.clear();
    if (products.length > 0) await db.products.bulkPut(products);
    if (localOnlyProducts.length > 0)
      await db.products.bulkPut(localOnlyProducts);
  }

  // Usuários, campanhas e metas: substitui pelo estado do servidor SOMENTE
  // quando o pull correspondente teve sucesso. Pull nulo (falha/RLS) = mantém
  // o que já existe no Dexie — nunca esvazia por engano.
  if (users !== null) {
    await db.users.clear();
    if (users.length > 0) await db.users.bulkPut(users);
  }

  if (campaigns !== null) {
    await db.campaigns.clear();
    if (campaigns.length > 0) await db.campaigns.bulkPut(campaigns);
  }

  if (goals !== null) {
    await db.goals.clear();
    if (goals.length > 0) await db.goals.bulkPut(goals);
  }

  // Pedidos: preserva os que ainda não subiram (pending/error). Só reconcilia
  // se o pull teve sucesso; remove apenas os que já estavam sincronizados e
  // regrava a versão do servidor por cima.
  if (orders !== null) {
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
}

/** True when the browser reports connectivity. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
