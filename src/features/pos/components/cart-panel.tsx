"use client";

import { ShoppingBasket, Trash2 } from "lucide-react";
import type { UseCart } from "@/features/pos/hooks/use-cart";
import { CartLine } from "./cart-line";
import { formatBRL } from "@/lib/utils/money";

interface CartPanelProps {
  cart: UseCart;
}

/** Middle column: the running sale plus the pinned totals summary. */
export function CartPanel({ cart }: CartPanelProps) {
  const { items, totals, count } = cart;

  return (
    <section className="flex h-full min-w-0 flex-col">
      <div className="flex items-center justify-between px-margin pt-md">
        <h2 className="flex min-w-0 items-center gap-2 text-body-lg text-on-surface sm:text-headline-md">
          <ShoppingBasket className="h-6 w-6 text-primary" strokeWidth={1.75} />
          Venda Atual
        </h2>
        {items.length > 0 && (
          <button
            onClick={cart.clear}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-label-md text-primary transition-colors hover:text-on-primary-container"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Limpar tudo
          </button>
        )}
      </div>

      <div className="scrollbar-slim min-w-0 flex-1 space-y-sm overflow-y-auto px-margin py-md">
        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          items.map((item) => {
            const key = cart.lineKey(item.productId, item.color, item.size);
            return (
              <CartLine
                key={key}
                item={item}
                onIncrement={() => cart.increment(key)}
                onDecrement={() => cart.decrement(key)}
                onRemove={() => cart.remove(key)}
              />
            );
          })
        )}
      </div>

      <div className="px-margin pb-md">
        <div className="rounded-lg bg-surface-container-low px-md py-md">
          <Row label="Subtotal" value={formatBRL(totals.subtotalCents)} />
          {totals.discountCents > 0 && (
            <Row
              label="Desconto"
              value={`- ${formatBRL(totals.discountCents)}`}
              accent
            />
          )}
          <div className="mt-sm border-t border-outline-variant/40 pt-sm">
            <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
              Total
            </p>
            <div className="flex items-end justify-between">
              <p className="min-w-0 break-words text-headline-lg leading-tight text-primary sm:text-display-md xl:text-display-lg">
                {formatBRL(totals.totalCents)}
              </p>
              <p className="pb-2 text-label-sm text-on-surface-variant">
                Itens: {count}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-body-md text-on-surface-variant">{label}</span>
      <span
        className={
          accent
            ? "text-body-md font-medium text-primary"
            : "text-body-md text-on-surface"
        }
      >
        {value}
      </span>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-xl text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container">
        <ShoppingBasket
          className="h-7 w-7 text-on-surface-variant/60"
          strokeWidth={1.5}
        />
      </div>
      <p className="text-body-md text-on-surface-variant">
        Nenhum item na venda.
      </p>
      <p className="text-label-sm text-on-surface-variant/70">
        Busque ou escaneie um produto para começar.
      </p>
    </div>
  );
}
