"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Order, PaymentMethod } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { Modal } from "@/components/ui/modal";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit: "Cartão",
  debit: "Cartão",
  pix: "Pix",
  wallet: "Carteira Digital",
};

/** Modal com todos os detalhes de uma venda: itens, cliente, valores, pagamento. */
export function OrderDetailsModal({
  order,
  onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  if (!order) return null;

  return (
    <Modal open={!!order} onClose={onClose} title={`Pedido ${order.reference}`}>
      <div className="space-y-md">
        <div className="grid grid-cols-2 gap-md">
          <Info label="Data">
            {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", {
              locale: ptBR,
            })}
          </Info>
          <Info label="Pagamento">{PAYMENT_LABEL[order.paymentMethod]}</Info>
          <Info label="Cliente">{order.customerName ?? "Sem cliente"}</Info>
          <Info label="Vendedora">{order.sellerName ?? "—"}</Info>
        </div>

        <div>
          <p className="mb-sm text-label-md font-semibold uppercase tracking-wide text-on-surface-variant">
            Itens
          </p>
          <div className="overflow-hidden rounded-lg border border-outline-variant/50">
            <table className="w-full text-body-md">
              <thead>
                <tr className="bg-surface-container text-label-sm uppercase tracking-wide text-on-surface-variant">
                  <th className="px-3 py-2 text-left font-medium">Produto</th>
                  <th className="px-2 py-2 text-left font-medium">Variação</th>
                  <th className="px-2 py-2 text-center font-medium">Qtd</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id} className="border-t border-outline-variant/40">
                    <td className="px-3 py-2 text-on-surface">{it.name}</td>
                    <td className="px-2 py-2 text-on-surface-variant">
                      {[it.color, it.size].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {it.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-on-surface">
                      {formatBRL(
                        it.unitPriceCents * it.quantity - it.lineDiscountCents,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg bg-surface-container-low px-md py-md">
          <Row label="Subtotal" value={formatBRL(order.subtotalCents)} />
          {order.discountCents > 0 && (
            <Row
              label="Desconto"
              value={`- ${formatBRL(order.discountCents)}`}
            />
          )}
          <div className="mt-1 flex items-center justify-between border-t border-outline-variant/40 pt-2">
            <span className="text-body-md font-semibold text-on-surface">
              Total
            </span>
            <span className="text-headline-md font-semibold text-primary">
              {formatBRL(order.totalCents)}
            </span>
          </div>
          {order.paymentMethod === "cash" && order.tenderedCents != null && (
            <>
              <Row label="Recebido" value={formatBRL(order.tenderedCents)} />
              <Row label="Troco" value={formatBRL(order.changeCents ?? 0)} />
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-label-sm uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="text-body-md text-on-surface">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-body-md text-on-surface-variant">{label}</span>
      <span className="text-body-md tabular-nums text-on-surface">{value}</span>
    </div>
  );
}
