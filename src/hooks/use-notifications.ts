"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { markAllRead, clearNotifications } from "@/lib/db/notification-repository";
import type { AppNotification } from "@/types/domain";

/** Live notifications for the bell menu, newest first, with unread count. */
export function useNotifications() {
  const items = useLiveQuery<AppNotification[]>(
    () => db.notifications.orderBy("createdAt").reverse().toArray(),
    [],
  );

  const list = items ?? [];
  const unread = list.filter((n) => !n.read).length;

  return { items: list, unread, markAllRead, clearNotifications };
}
