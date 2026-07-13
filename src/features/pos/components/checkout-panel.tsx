"use client";

import { Banknote, CreditCard, QrCode, Check } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { PaymentMethod } from "@/types/domain";
import { PAYMENT_OPTIONS } from "@/features/pos/types";
import { formatBRL } from "@/lib/utils/money";
import { changeCents } from "@/lib/utils/cart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

interface CheckoutPanelProps {
  totalCents: number;
  method: PaymentMethod;
  onMethodChange: (method: PaymentMethod) => void;
  tenderedCents: number;
  /** Texto do valor recebido (reais) controlado pela tela do PDV. */
  tenderInput: string;
  onTenderInput: (value: string) => void;
  onFinalize: () => void;
  canFinalize: boolean;
  saving?: boolean;
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
  tenderInput,
  onTenderInput,
  onFinalize,
  canFinalize,
  saving = false,
  meta,
}: CheckoutPanelProps) {
  const isCash = method === "cash";
  const change = changeCents(totalCents, tenderedCents);
  const shortfall = isCash && tenderedCents < totalCents;

  return (
    <aside className="flex h-full flex-col gap-sm px-margin py-md lg:border-l lg:border-outline-variant/50">
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
                "flex flex-col items-center gap-1.5 rounded-md border py-3 transition-colors",
                active
                  ? "border-primary bg-primary-fixed/40 text-primary"
                  : "border-outline-variant text-on-surface-variant hover:bg-surface-container",
              )}
              aria-pressed={active}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="text-label-md">{label}</span>
            </button>
          );
        })}
      </div>

      {isCash ? (
        <>
          <div className="space-y-1.5">
            <Label>Valor recebido</Label>
            <Input
              value={tenderInput}
              onChange={(e) => onTenderInput(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Valor recebido em dinheiro"
              className="text-right text-headline-md tabular-nums"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
            <span className="text-label-md text-on-surface-variant">Troco</span>
            <span
              className={cn(
                "text-headline-md font-semibold tabular-nums",
                shortfall ? "text-error" : "text-primary",
              )}
            >
              {formatBRL(change)}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-lg bg-surface-container-low px-md py-lg text-center">
          <p className="text-body-md text-on-surface-variant">
            Total a cobrar
          </p>
          <p className="break-words text-display-sm leading-tight text-primary sm:text-display-md">
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
        disabled={!canFinalize || saving}
        className={cn(
          "mt-auto flex h-14 items-center justify-center gap-2 rounded-full text-body-lg font-semibold transition-colors",
          canFinalize && !saving
            ? "bg-primary-container text-on-primary-container hover:bg-primary-fixed-dim"
            : "cursor-not-allowed bg-surface-container text-on-surface-variant/50",
        )}
      >
        {saving ? (
          <>
            <Spinner className="h-5 w-5" />
            Processando...
          </>
        ) : (
          <>
            <Check className="h-5 w-5" strokeWidth={2} />
            Finalizar Venda
          </>
        )}
      </button>
    </aside>
  );
}
