"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  listNotifications,
  markAllRead as markAllReadRepo,
  clearNotifications as clearNotificationsRepo,
} from "@/lib/db/notification-repository";
import { queryKeys } from "@/lib/db/query-keys";
import { useRealtimeInvalidation } from "@/lib/db/use-realtime-invalidation";

/** Notificações ao vivo do sino, mais recentes primeiro, com contagem de não lidas. */
export function useNotifications() {
  useRealtimeInvalidation("notifications", queryKeys.notifications);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: listNotifications,
  });

  const list = data ?? [];
  const unread = list.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    await markAllReadRepo();
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  const clearNotifications = useCallback(async () => {
    await clearNotificationsRepo();
    await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }, [queryClient]);

  return { items: list, unread, markAllRead, clearNotifications };
}
