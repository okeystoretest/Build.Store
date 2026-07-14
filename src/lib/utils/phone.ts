/**
 * Máscara de telefone brasileiro: (XX) XXXXX-XXXX (celular, 11 dígitos) ou
 * (XX) XXXX-XXXX (fixo, 10 dígitos). Formata progressivamente conforme digita.
 */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Remove tudo que não é dígito. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}
