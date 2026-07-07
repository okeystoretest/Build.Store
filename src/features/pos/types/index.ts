import type { PaymentMethod } from "@/types/domain";

/** Payment method option shown in the checkout selector. */
export interface PaymentOption {
  method: PaymentMethod;
  label: string;
}

export const PAYMENT_OPTIONS: PaymentOption[] = [
  { method: "cash", label: "Dinheiro" },
  { method: "credit", label: "Crédito" },
  { method: "debit", label: "Débito" },
  { method: "pix", label: "Pix" },
];
