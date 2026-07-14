import type { PaymentMethod } from "@/types/domain";

/** Payment method option shown in the checkout selector. */
export interface PaymentOption {
  method: PaymentMethod;
  label: string;
}

/**
 * Opções exibidas no checkout. "Crédito" e "Débito" foram unificados em uma
 * única opção "Cartão" na UI — internamente a venda é registrada como "credit"
 * (a lógica e o enum PaymentMethod permanecem intactos, com débito ainda
 * suportado em dados legados e em relatórios).
 */
export const PAYMENT_OPTIONS: PaymentOption[] = [
  { method: "cash", label: "Dinheiro" },
  { method: "credit", label: "Cartão" },
  { method: "pix", label: "Pix" },
];
