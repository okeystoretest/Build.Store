"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Sistema de toasts para feedback visual das ações críticas (salvar, criar,
 * excluir, finalizar venda). Leve, sem dependência externa: contexto + hook +
 * UI com animação de entrada/saída via CSS (ver globals: toast-in/toast-out).
 */

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastKind, typeof Check> = {
  success: Check,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: "border-primary/30 bg-surface-container-lowest text-on-surface",
  error: "border-error/40 bg-error-container text-on-error-container",
  info: "border-outline-variant bg-surface-container-lowest text-on-surface",
};

const ICON_TONE: Record<ToastKind, string> = {
  success: "bg-primary/15 text-primary",
  error: "bg-error/15 text-error",
  info: "bg-outline-variant/30 text-on-surface-variant",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    // Marca como saindo para tocar a animação, depois remove.
    setToasts((list) =>
      list.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
    );
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, kind, message }]);
      // Auto-dismiss.
      setTimeout(() => remove(id), 2600);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (m: string) => toast(m, "success"),
      error: (m: string) => toast(m, "error"),
      info: (m: string) => toast(m, "info"),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-level-2",
                STYLES[t.kind],
                t.leaving ? "animate-toast-out" : "animate-toast-in",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  ICON_TONE[t.kind],
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <p className="flex-1 text-label-md">{t.message}</p>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Fechar"
                className="text-on-surface-variant transition-colors hover:text-on-surface"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Acessa as funções de toast. Deve estar dentro de <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback silencioso: nunca quebra a UI se usado fora do provider.
    return {
      toast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
