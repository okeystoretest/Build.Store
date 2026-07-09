import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PaymentMethod } from "@/types/domain";
import { formatBRL } from "@/lib/utils/money";
import type {
  SalesSummary,
  ProductRank,
} from "@/features/analytics/aggregations";

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit: "Crédito",
  debit: "Débito",
  pix: "Pix",
  wallet: "Carteira Digital",
};

interface ReportData {
  summary: SalesSummary;
  top: ProductRank[];
  payments: Record<PaymentMethod, { count: number; totalCents: number }>;
}

/**
 * Gera e baixa o Relatório atual em PDF (A4). Client-side com jsPDF: KPIs,
 * ranking de produtos e fechamento por forma de pagamento.
 */
export function generateReportPdf(data: ReportData, storeName: string): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const left = 16;
  const right = pageW - 16;
  let y = 20;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(storeName, left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y += 7;
  doc.text("Relatório de vendas", left, y);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    right,
    y,
    { align: "right" },
  );
  doc.setTextColor(0);
  y += 6;
  doc.setLineWidth(0.3);
  doc.line(left, y, right, y);
  y += 10;

  // KPIs
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo", left, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const kpis: [string, string][] = [
    ["Receita total", formatBRL(data.summary.revenueCents)],
    ["Ticket médio", formatBRL(data.summary.averageTicketCents)],
    ["Itens vendidos", data.summary.itemsSold.toLocaleString("pt-BR")],
    ["Pedidos", data.summary.orderCount.toLocaleString("pt-BR")],
    ["Taxa de estorno", `${(data.summary.refundRate * 100).toFixed(1)}%`],
  ];
  for (const [label, value] of kpis) {
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
    y += 7;
  }
  y += 4;
  doc.setLineWidth(0.2);
  doc.line(left, y, right, y);
  y += 10;

  // Ranking de produtos
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Produtos mais vendidos", left, y);
  y += 8;
  doc.setFontSize(10);
  doc.text("Produto", left, y);
  doc.text("Qtd", right - 40, y, { align: "right" });
  doc.text("Receita", right, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.1);
  doc.line(left, y, right, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  if (data.top.length === 0) {
    doc.setTextColor(120);
    doc.text("Sem vendas no período.", left, y);
    doc.setTextColor(0);
    y += 7;
  } else {
    for (const p of data.top) {
      doc.text(p.name.slice(0, 48), left, y);
      doc.text(String(p.unitsSold), right - 40, y, { align: "right" });
      doc.text(formatBRL(p.revenueCents), right, y, { align: "right" });
      y += 7;
    }
  }
  y += 4;
  doc.setLineWidth(0.2);
  doc.line(left, y, right, y);
  y += 10;

  // Fechamento por forma de pagamento
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Fechamento por pagamento", left, y);
  y += 8;
  doc.setFontSize(10);
  doc.text("Forma", left, y);
  doc.text("Vendas", right - 40, y, { align: "right" });
  doc.text("Total", right, y, { align: "right" });
  y += 2;
  doc.setLineWidth(0.1);
  doc.line(left, y, right, y);
  y += 6;
  doc.setFont("helvetica", "normal");

  let grand = 0;
  (Object.keys(data.payments) as PaymentMethod[]).forEach((method) => {
    const { count, totalCents } = data.payments[method];
    grand += totalCents;
    doc.text(PAYMENT_LABEL[method], left, y);
    doc.text(String(count), right - 40, y, { align: "right" });
    doc.text(formatBRL(totalCents), right, y, { align: "right" });
    y += 7;
  });
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(left, y, right, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total geral", left, y);
  doc.text(formatBRL(grand), right, y, { align: "right" });

  const stamp = format(new Date(), "yyyy-MM-dd", { locale: ptBR });
  doc.save(`relatorio-${stamp}.pdf`);
}
