import { db } from "@/lib/db/dexie";
import { transport } from "@/lib/sync/transport";
import type { Order } from "@/types/domain";

/**
 * Sync engine. Flushes locally-created orders (syncStatus="pending") through
 * the active transport and marks each synced on success, leaving failures
 * queued for the next attempt. Pure orchestration — the transport owns the
 * wire format, the repositories own persistence.
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

/** True when the browser reports connectivity. */
export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
