"use client";

import { Banknote, CreditCard, QrCode, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";

interface PaymentBreakdownProps {
  data: Record<PaymentMethod, { count: number; totalCents: number }>;
}

const META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  cash: { label: "Dinheiro", icon: Banknote },
  credit: { label: "Crédito", icon: CreditCard },
  debit: { label: "Débito", icon: CreditCard },
  pix: { label: "Pix", icon: QrCode },
  wallet: { label: "Carteira", icon: Wallet },
};

const ORDER: PaymentMethod[] = ["cash", "credit", "debit", "pix", "wallet"];

/** Cash-closing report: revenue by payment method. */
export function PaymentBreakdown({ data }: PaymentBreakdownProps) {
  const grandTotal = ORDER.reduce((s, m) => s + data[m].totalCents, 0);

  return (
    <div className="rounded-lg bg-surface-container-lowest p-md shadow-level-1">
      <h3 className="text-headline-md text-on-surface">Fechamento de Caixa</h3>
      <p className="mt-1 text-label-md text-on-surface-variant">
        Receita por forma de pagamento
      </p>
      <div className="mt-md space-y-sm">
        {ORDER.filter((m) => data[m].count > 0).map((m) => {
          const { label, icon: Icon } = META[m];
          const { count, totalCents } = data[m];
          const pct = grandTotal ? Math.round((totalCents / grandTotal) * 100) : 0;
          return (
            <div key={m} className="flex items-center gap-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed/60 text-primary">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-body-md text-on-surface">{label}</span>
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatBRL(totalCents)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-label-sm text-on-surface-variant">
                    {count}x
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="mt-md flex items-center justify-between border-t border-outline-variant/40 pt-md">
          <span className="text-label-md uppercase tracking-wide text-on-surface-variant">
            Total
          </span>
          <span className="text-headline-md text-primary">
            {formatBRL(grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
