"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  listNotificationsAction,
  markAllReadAction as markAllReadRepo,
  clearNotificationsAction as clearNotificationsRepo,
} from "@/features/notifications/actions/notifications";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";
import { useActiveStoreId } from "@/features/stores/store-context";

/** Notificações ao vivo do sino, mais recentes primeiro, com contagem de não lidas. */
export function useNotifications() {
  const storeId = useActiveStoreId();
  useRealtimeInvalidation("notifications", queryKeys.notifications);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: [...queryKeys.notifications, storeId],
    queryFn: () => listNotificationsAction(storeId),
  });

  const list = data ?? [];
  const unread = list.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    await markAllReadRepo(storeId);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient, storeId]);

  const clearNotifications = useCallback(async () => {
    await clearNotificationsRepo(storeId);
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient, storeId]);

  return { items: list, unread, markAllRead, clearNotifications };
}
