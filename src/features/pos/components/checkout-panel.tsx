"use client";

import { Banknote, CreditCard, QrCode, Check } from "lucide-react";
import type { PaymentMethod } from "@/types/domain";
import { PAYMENT_OPTIONS } from "@/features/pos/types";
import { formatBRL } from "@/lib/utils/money";
import { changeCents } from "@/lib/utils/cart";
import { Keypad } from "./keypad";
import { cn } from "@/lib/utils/cn";

interface CheckoutPanelProps {
  totalCents: number;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  tenderedCents: number;
  onTenderDigit: (digit: string) => void;
  onTenderClear: () => void;
  onTenderBackspace: () => void;
  onFinalize: () => void;
  canFinalize: boolean;
  /** Seller + campaign selectors, rendered above the finalize button. */
  meta?: React.ReactNode;
}

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  credit: CreditCard,
  debit: CreditCard,
  pix: QrCode,
  wallet: QrCode,
};

/** Right column: how the customer pays and the tender/change math. */
export function CheckoutPanel({
  totalCents,
  method,
  onMethodChange,
  tenderedCents,
  onTenderDigit,
  onTenderClear,
  onTenderBackspace,
  onFinalize,
  canFinalize,
  meta,
}: CheckoutPanelProps) {
  const isCash = method === "cash";
  const change = changeCents(totalCents, tenderedCents);
  const shortfall = isCash && tenderedCents < totalCents;

  return (
    <aside className="flex h-full flex-col gap-md overflow-y-auto border-l border-outline-variant/50 px-margin py-md">
      <h2 className="text-headline-md text-on-surface">Checkout</h2>

      <div className="grid grid-cols-3 gap-sm">
        {PAYMENT_OPTIONS.map(({ method: m, label }) => {
          const Icon = METHOD_ICON[m];
          const active = method === m;
          return (
            <button
              key={m}
              onClick={() => onMethodChange(m)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border py-md transition-colors",
                active
                  ? "border-primary bg-primary-fixed/40 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
              )}
              aria-pressed={active}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} />
              <span className="text-label-md">{label}</span>
            </button>
          );
        })}
      </div>

      {isCash ? (
        <>
          <div className="rounded-full bg-surface-container-low px-md py-4">
            <div className="flex items-center justify-between">
              <span className="text-label-md text-on-surface-variant">
                Recebido:
              </span>
              <span className="text-headline-md tabular-nums text-on-surface">
                {formatBRL(tenderedCents)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between px-md">
            <span className="text-label-md text-on-surface-variant">
              Troco calculado
            </span>
            <span
              className={cn(
                "text-headline-md tabular-nums",
                shortfall ? "text-error" : "text-primary",
              )}
            >
              {formatBRL(change)}
            </span>
          </div>

          <Keypad
            onDigit={onTenderDigit}
            onClear={onTenderClear}
            onBackspace={onTenderBackspace}
          />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-surface-container-low px-md py-xl text-center">
          <p className="text-body-md text-on-surface-variant">
            Total a cobrar
          </p>
          <p className="text-display-lg text-primary">
            {formatBRL(totalCents)}
          </p>
          <p className="text-label-sm text-on-surface-variant/70">
            Confirme o pagamento no terminal e finalize.
          </p>
        </div>
      )}

      {meta}

      <button
        onClick={onFinalize}
        disabled={!canFinalize}
        className={cn(
          "mt-auto flex h-16 items-center justify-center gap-2 rounded-full text-body-lg font-semibold transition-colors",
          canFinalize
            ? "bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim"
            : "cursor-not-allowed bg-surface-container text-on-surface-variant/50",
        )}
      >
        <Check className="h-5 w-5" strokeWidth={2} />
        Finalizar Venda
      </button>
    </aside>
  );
}
