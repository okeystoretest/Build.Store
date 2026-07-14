/**
 * Referência de pedido no padrão "#PDD-XXX", com número sequencial preenchido
 * com zeros à esquerda (mínimo 3 dígitos): #PDD-001, #PDD-002, ... #PDD-1000.
 */
export function orderReference(seq: number): string {
  return `#PDD-${String(seq).padStart(3, "0")}`;
}
