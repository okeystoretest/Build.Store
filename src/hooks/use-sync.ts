"use client";

import { useEffect, useState, useCallback } from "react";
import { flushPending, isOnline, pendingCount } from "@/lib/sync/sync-engine";

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
}

/**
 * Connectivity + sync status for the whole app. Tracks the pending-order count,
 * reacts to online/offline events, and auto-flushes when connectivity returns.
 * The status badge and any "N vendas pendentes" indicator read from here.
 */
export function useSync() {
  const [state, setState] = useState<SyncState>({
    online: true,
    pending: 0,
    syncing: false,
  });

  const refreshPending = useCallback(async () => {
    const pending = await pendingCount();
    setState((s) => ({ ...s, pending }));
  }, []);

  const flush = useCallback(async () => {
    if (!isOnline()) return;
    setState((s) => ({ ...s, syncing: true }));
    await flushPending();
    const pending = await pendingCount();
    setState((s) => ({ ...s, syncing: false, pending }));
  }, []);

  useEffect(() => {
    const update = () => setState((s) => ({ ...s, online: isOnline() }));
    update();
    void refreshPending();

    const onOnline = () => {
      update();
      void flush();
    };
    const onOffline = () => update();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush, refreshPending]);

  return { ...state, flush, refreshPending };
}
