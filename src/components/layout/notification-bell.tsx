"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Package } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNotifications } from "@/hooks/use-notifications";

/**
 * Notification bell. Shows an unread badge and a dropdown listing recent
 * notifications (e.g. a product added by an Admin, carrying Ref/Nome/Qtd).
 * Opening the menu marks everything read.
 */
export function NotificationBell() {
  const { items, unread, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) void markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggle}
        aria-label="Notificações"
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-on-primary">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg bg-surface-container-lowest shadow-level-2">
          <div className="border-b border-outline-variant/40 px-md py-sm">
            <p className="text-label-md font-semibold text-on-surface">
              Notificações
            </p>
          </div>
          {items.length === 0 ? (
            <p className="px-md py-lg text-center text-body-md text-on-surface-variant">
              Nenhuma notificação.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="flex gap-3 border-b border-outline-variant/30 px-md py-sm last:border-0"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed/60 text-primary">
                    <Package className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-label-md font-medium text-on-surface">
                      {n.title}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {n.body}
                    </p>
                    <p className="mt-0.5 text-label-sm text-on-surface-variant/70">
                      {formatDistanceToNow(new Date(n.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
