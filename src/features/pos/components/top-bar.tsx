"use client";

import { Search, Bell, CloudOff, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface TopBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  online: boolean;
  pending?: number;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}

/** PDV header: product search / barcode scan, sync status, checkout shortcut. */
export function TopBar({
  query,
  onQueryChange,
  online,
  pending = 0,
  onCheckout,
  checkoutDisabled,
}: TopBarProps) {
  return (
    <header className="flex items-center gap-md border-b border-outline-variant/50 px-margin py-md">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant"
          strokeWidth={1.75}
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar produtos ou escanear código..."
          aria-label="Buscar produtos"
          className="h-14 w-full rounded-full border border-outline-variant bg-surface pl-14 pr-6 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container focus:outline-none"
        />
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-label-sm font-semibold",
          online
            ? "bg-surface-container text-on-surface-variant"
            : "bg-error-container text-on-error-container",
        )}
        role="status"
      >
        {online ? (
          <Cloud className="h-4 w-4" strokeWidth={1.75} />
        ) : (
          <CloudOff className="h-4 w-4" strokeWidth={1.75} />
        )}
        {online
          ? pending > 0
            ? `Sincronizando ${pending}`
            : "Pronto"
          : pending > 0
            ? `Offline · ${pending} pendente${pending > 1 ? "s" : ""}`
            : "Offline"}
      </div>

      <button
        aria-label="Notificações"
        className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container"
      >
        <Bell className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <Button onClick={onCheckout} disabled={checkoutDisabled}>
        Finalizar
      </Button>
    </header>
  );
}
