"use client";

import { useEffect, useState } from "react";
import { Search, CloudOff, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { cn } from "@/lib/utils/cn";

interface TopBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onCheckout: () => void;
  checkoutDisabled: boolean;
}

/**
 * Cabeçalho do PDV: busca/scanner, indicador de conexão e atalho de finalizar.
 *
 * App online-only: o indicador reflete apenas a conectividade do navegador
 * (navigator.onLine). Como toda venda exige rede, ele avisa a operadora quando
 * a conexão cai — não há mais fila de pendências offline.
 */
export function TopBar({
  query,
  onQueryChange,
  onCheckout,
  checkoutDisabled,
}: TopBarProps) {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () =>
      setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
        {online ? "Conectado" : "Sem conexão"}
      </div>

      <NotificationBell />

      <Button onClick={onCheckout} disabled={checkoutDisabled}>
        Finalizar
      </Button>
    </header>
  );
}
