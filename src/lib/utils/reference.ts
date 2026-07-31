/**
 * Referências de pedido — apenas sequência numérica (sem prefixo).
 *
 * A numeração continua vindo do servidor (RPC next_order_reference no
 * Supabase). O valor ARMAZENADO pode ainda conter o prefixo legado "#PDD-"
 * em pedidos antigos; `displayReference` normaliza para exibir só os dígitos,
 * então pedidos antigos e novos aparecem de forma consistente.
 *
 * NOTA: para que o valor GRAVADO passe a ser só numérico em novos pedidos,
 * é preciso ajustar a função SQL next_order_reference() no banco. No frontend
 * garantimos a exibição limpa independentemente do que estiver armazenado.
 */
export function orderReference(seq: number): string {
  return String(seq).padStart(3, "0");
}

/** Remove qualquer prefixo não numérico (ex.: "#PDD-001" → "001"). */
export function displayReference(reference: string | null | undefined): string {
  if (!reference) return "";
  const digits = reference.replace(/\D/g, "");
  return digits.length > 0 ? digits : reference;
}
