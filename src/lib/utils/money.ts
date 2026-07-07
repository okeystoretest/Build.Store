/**
 * Money helpers. All monetary values move through the app as integer centavos
 * to avoid floating-point drift; formatting to BRL happens only at the edge.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Format integer centavos as "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** Parse a user-typed "12,50" or "12.50" into integer centavos. */
export function parseToCents(input: string): number {
  const normalized = input.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}
