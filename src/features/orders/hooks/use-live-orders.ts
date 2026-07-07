"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import type { Order } from "@/types/domain";

/** Live order list from Dexie, newest first. Updates as sales are recorded. */
export function useLiveOrders(): Order[] | undefined {
  return useLiveQuery(
    () => db.orders.orderBy("createdAt").reverse().toArray(),
    [],
  );
}
