"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search, CloudOff, Cloud, X, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useIsMobileScanner } from "@/features/pos/hooks/use-is-mobile-scanner";
import { cn } from "@/lib/utils/cn";

// Carrega o scanner (e a lib zxing) só quando aberto — mantém o PDV leve.
const BarcodeScanner = dynamic(
  () => import("./barcode-scanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);

interface TopBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onCheckout: () => void;
  checkoutDisabled: boolean;
  /** Recebe um código lido pela câmera (mesmo fluxo da digitação/scanner USB). */
  onScan?: (code: string) => void;
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
  onScan,
}: TopBarProps) {
  const [online, setOnline] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Botão da câmera só em dispositivo mobile real (toque + câmera).
  const isMobileScanner = useIsMobileScanner();

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
    <header className="flex items-center gap-3 border-b border-outline-variant/50 px-3 py-3 sm:gap-md sm:px-margin">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant sm:left-5"
          strokeWidth={1.75}
        />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Buscar produtos ou escanear código..."
          aria-label="Buscar produtos"
          className={cn(
            "h-12 w-full rounded-full border border-outline-variant bg-surface pl-12 text-body-md text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary-container focus:outline-none sm:h-14 sm:pl-14",
            // Reserva espaço à direita: câmera (mobile) e/ou limpar.
            isMobileScanner ? "pr-20 sm:pr-20" : "pr-12 sm:pr-14",
          )}
        />
        {/* Limpar busca — só aparece quando há texto. */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Limpar busca"
            title="Limpar busca"
            className={cn(
              "absolute top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface",
              // Se o botão de câmera está presente, desloca o X para a esquerda dele.
              isMobileScanner ? "right-12" : "right-3 sm:right-4",
            )}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        {/* Botão da câmera — só em mobile real (decisão 1b). */}
        {isMobileScanner && (
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            aria-label="Ler código de barras com a câmera"
            title="Ler código de barras"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-fixed/40"
          >
            <ScanLine className="h-5 w-5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div
        className={cn(
          "hidden items-center gap-2 rounded-full px-4 py-2 text-label-sm font-semibold sm:flex",
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

      <Button
        onClick={onCheckout}
        disabled={checkoutDisabled}
        className="hidden lg:inline-flex"
      >
        Finalizar
      </Button>

      {isMobileScanner && scannerOpen && (
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onDetected={(code) => {
            if (onScan) onScan(code);
            else onQueryChange(code);
          }}
        />
      )}
    </header>
  );
}
