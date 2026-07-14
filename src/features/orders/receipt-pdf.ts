import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Order, PaymentMethod } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit: "Cartão",
  debit: "Cartão",
  pix: "Pix",
  wallet: "Carteira Digital",
};

/**
 * Gera e baixa um comprovante do pedido em PDF (formato cupom, 80mm de largura).
 * Puramente client-side com jsPDF — funciona no navegador sem servidor.
 */
export function generateReceiptPdf(order: Order, storeName: string): void {
  // Cupom de 80mm; altura cresce com o número de itens.
  const width = 80;
  const lineH = 5;
  const headerH = 46;
  const footerH = 40;
  const height = headerH + order.items.length * lineH * 2 + footerH;

  const doc = new jsPDF({ unit: "mm", format: [width, Math.max(height, 120)] });
  const left = 6;
  const right = width - 6;
  let y = 10;

  const center = (text: string, yy: number, size = 10, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, width / 2, yy, { align: "center" });
  };
  const row = (l: string, r: string, yy: number, size = 9, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(l, left, yy);
    doc.text(r, right, yy, { align: "right" });
  };
  const divider = (yy: number) => {
    doc.setLineWidth(0.1);
    doc.line(left, yy, right, yy);
  };

  center(storeName, y, 13, true);
  y += 5;
  center("Comprovante de Venda", y, 9);
  y += 6;
  divider(y);
  y += 5;

  row("Pedido:", order.reference, y, 9, true);
  y += lineH;
  row(
    "Data:",
    format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    y,
  );
  y += lineH;
  if (order.customerName) {
    row("Cliente:", order.customerName, y);
    y += lineH;
  }
  if (order.sellerName) {
    row("Vendedora:", order.sellerName, y);
    y += lineH;
  }
  y += 1;
  divider(y);
  y += 5;

  // Itens
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Item", left, y);
  doc.text("Total", right, y, { align: "right" });
  y += lineH;
  doc.setFont("helvetica", "normal");

  for (const item of order.items) {
    const variation = [item.color, item.size].filter(Boolean).join(" · ");
    const title = variation ? `${item.name} (${variation})` : item.name;
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(title, right - left - 20), left, y);
    doc.text(
      formatBRL(item.unitPriceCents * item.quantity - item.lineDiscountCents),
      right,
      y,
      { align: "right" },
    );
    y += lineH;
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `${item.quantity} x ${formatBRL(item.unitPriceCents)}`,
      left,
      y,
    );
    doc.setTextColor(0);
    y += lineH;
  }

  y += 1;
  divider(y);
  y += 5;

  row("Subtotal:", formatBRL(order.subtotalCents), y);
  y += lineH;
  if (order.discountCents > 0) {
    row("Desconto:", `- ${formatBRL(order.discountCents)}`, y);
    y += lineH;
  }
  row("TOTAL:", formatBRL(order.totalCents), y, 11, true);
  y += lineH + 1;
  row("Pagamento:", PAYMENT_LABEL[order.paymentMethod], y);
  y += lineH;
  if (order.paymentMethod === "cash" && order.tenderedCents != null) {
    row("Recebido:", formatBRL(order.tenderedCents), y);
    y += lineH;
    row("Troco:", formatBRL(order.changeCents ?? 0), y);
    y += lineH;
  }

  y += 3;
  center("Obrigada pela preferência!", y, 9);

  doc.save(`comprovante-${order.reference.replace(/[^\w-]/g, "")}.pdf`);
}
