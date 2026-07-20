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
  if (order.invoiceNumber) {
    row("Nota Fiscal:", order.invoiceNumber, y);
    y += lineH;
  }
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

/**
 * Impressão DIRETA do comprovante (sem baixar PDF). Monta um cupom em HTML
 * (80mm), opcionalmente com o logotipo da loja no cabeçalho, abre uma janela
 * oculta e dispara o diálogo de impressão do navegador. A janela se fecha
 * sozinha após a impressão.
 */
export function printReceipt(
  order: Order,
  storeName: string,
  logoUrl?: string | null,
): void {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;",
    );

  const itemsHtml = order.items
    .map((item) => {
      const variation = [item.color, item.size].filter(Boolean).join(" · ");
      const title = variation ? `${item.name} (${variation})` : item.name;
      const lineTotal = formatBRL(
        item.unitPriceCents * item.quantity - item.lineDiscountCents,
      );
      return `
        <div class="item">
          <div class="item-row">
            <span class="item-name">${esc(title)}</span>
            <span class="item-total">${esc(lineTotal)}</span>
          </div>
          <div class="item-sub">${item.quantity} x ${esc(formatBRL(item.unitPriceCents))}</div>
        </div>`;
    })
    .join("");

  const cashRows =
    order.paymentMethod === "cash" && order.tenderedCents != null
      ? `<div class="row"><span>Recebido</span><span>${esc(formatBRL(order.tenderedCents))}</span></div>
         <div class="row"><span>Troco</span><span>${esc(formatBRL(order.changeCents ?? 0))}</span></div>`
      : "";

  const discountRow =
    order.discountCents > 0
      ? `<div class="row"><span>Desconto</span><span>- ${esc(formatBRL(order.discountCents))}</span></div>`
      : "";

  const invoiceRow = order.invoiceNumber
    ? `<div class="row"><span>Nota Fiscal</span><span>${esc(order.invoiceNumber)}</span></div>`
    : "";

  const customerRow = order.customerName
    ? `<div class="row"><span>Cliente</span><span>${esc(order.customerName)}</span></div>`
    : "";

  const sellerRow = order.sellerName
    ? `<div class="row"><span>Vendedora</span><span>${esc(order.sellerName)}</span></div>`
    : "";

  const logoHtml = logoUrl
    ? `<img class="logo" src="${logoUrl}" alt="Logo" />`
    : "";

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Comprovante ${esc(order.reference)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; font-size: 12px; }
  .center { text-align: center; }
  .logo { max-width: 48mm; max-height: 22mm; object-fit: contain; margin: 0 auto 6px; display: block; }
  .store { font-size: 16px; font-weight: 700; }
  .sub { font-size: 11px; color: #444; margin-bottom: 6px; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .item { padding: 2px 0; }
  .item-row { display: flex; justify-content: space-between; gap: 8px; }
  .item-name { font-size: 12px; }
  .item-total { font-size: 12px; white-space: nowrap; }
  .item-sub { font-size: 10px; color: #666; }
  .total { font-size: 15px; font-weight: 700; }
  .thanks { margin-top: 8px; font-size: 11px; }
</style>
</head>
<body>
  <div class="center">
    ${logoHtml}
    <div class="store">${esc(storeName)}</div>
    <div class="sub">Comprovante de Venda</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span><strong>Pedido</strong></span><span><strong>${esc(order.reference)}</strong></span></div>
  <div class="row"><span>Data</span><span>${esc(format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }))}</span></div>
  ${invoiceRow}
  ${customerRow}
  ${sellerRow}
  <div class="divider"></div>
  ${itemsHtml}
  <div class="divider"></div>
  <div class="row"><span>Subtotal</span><span>${esc(formatBRL(order.subtotalCents))}</span></div>
  ${discountRow}
  <div class="row total"><span>TOTAL</span><span>${esc(formatBRL(order.totalCents))}</span></div>
  <div class="row"><span>Pagamento</span><span>${esc(PAYMENT_LABEL[order.paymentMethod])}</span></div>
  ${cashRows}
  <div class="center thanks">Obrigada pela preferência!</div>
</body>
</html>`;

  // iframe oculto: imprime sem abrir aba nova nem exigir pop-up.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    // Remove o iframe depois de dar tempo ao diálogo de impressão.
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  // Espera o logo (se houver) carregar antes de imprimir.
  const img = doc.querySelector("img.logo") as HTMLImageElement | null;
  if (img && !img.complete) {
    img.onload = triggerPrint;
    img.onerror = triggerPrint;
  } else {
    // Pequeno atraso garante layout aplicado.
    setTimeout(triggerPrint, 150);
  }
}
