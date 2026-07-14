"use client";

import {
  Eye,
  Printer,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Order, OrderStatus, PaymentMethod } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import { STATUS_LABELS } from "@/features/analytics/aggregations";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

interface OrdersTableProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onReprint: (order: Order) => void;
  onRefund: (order: Order) => void;
  canRefund: boolean;
}

const STATUS_TONE: Record<OrderStatus, "success" | "error" | "neutral" | "primary"> = {
  completed: "success",
  refunded: "error",
  cancelled: "neutral",
  pending: "primary",
};

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit: "Cartão",
  debit: "Cartão",
  pix: "Pix",
  wallet: "Carteira Digital",
};

const PAYMENT_ICON: Record<PaymentMethod, typeof CreditCard> = {
  cash: Banknote,
  credit: CreditCard,
  debit: CreditCard,
  pix: QrCode,
  wallet: QrCode,
};

/** Order history table. Avoids heavy grid lines per the design system. */
export function OrdersTable({
  orders,
  onViewDetails,
  onReprint,
  onRefund,
  canRefund,
}: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg bg-surface-container-lowest px-md py-xl text-center shadow-level-1">
        <p className="text-body-md text-on-surface-variant">
          Nenhum pedido encontrado para os filtros atuais.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg bg-surface-container-lowest shadow-level-1 scrollbar-slim">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr className="border-b border-outline-variant/40 text-left">
            <Th>Pedido</Th>
            <Th>Data</Th>
            <Th>Cliente</Th>
            <Th>Pagamento</Th>
            <Th className="text-right">Total</Th>
            <Th>Status</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const Icon = PAYMENT_ICON[o.paymentMethod];
            const initials = (o.customerName ?? "—")
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <tr
                key={o.id}
                className="border-b border-outline-variant/30 last:border-0"
              >
                <Td className="font-medium text-primary">{o.reference}</Td>
                <Td className="text-on-surface-variant">
                  {format(new Date(o.createdAt), "dd MMM yyyy, HH:mm", {
                    locale: ptBR,
                  })}
                </Td>
                <Td>
                  <span className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-label-sm font-semibold text-primary">
                      {initials}
                    </span>
                    <span className="text-on-surface">
                      {o.customerName ?? "Sem cliente"}
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="flex items-center gap-2 text-on-surface-variant">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {PAYMENT_LABEL[o.paymentMethod]}
                  </span>
                </Td>
                <Td className="text-right font-semibold text-on-surface">
                  {formatBRL(o.totalCents)}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[o.status]}>
                    {STATUS_LABELS[o.status]}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <IconBtn label="Ver detalhes" onClick={() => onViewDetails(o)}>
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    </IconBtn>
                    <IconBtn
                      label="Reimprimir comprovante"
                      onClick={() => onReprint(o)}
                    >
                      <Printer className="h-4 w-4" strokeWidth={1.75} />
                    </IconBtn>
                    {canRefund && (
                      <IconBtn
                        label="Estornar pedido"
                        onClick={() => onRefund(o)}
                        danger
                      >
                        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
                      </IconBtn>
                    )}
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-md py-md text-label-md font-semibold text-on-surface-variant",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-md py-md text-body-md align-middle", className)}>
      {children}
    </td>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors",
        danger
          ? "hover:bg-error-container hover:text-on-error-container"
          : "hover:bg-surface-container hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
