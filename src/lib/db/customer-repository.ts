import { createClient } from "@/lib/supabase/client";
import { CUSTOMER_COLUMNS, toCustomer } from "@/lib/db/mappers";
import type { Customer } from "@/types/domain";

/**
 * Customer repository — online-only. Tudo direto no Supabase (tabela
 * `customers`). Cobre o cadastro (com código automático e único), a listagem e
 * a busca por autocomplete do PDV (por nome OU código).
 */

/** Só dígitos, para armazenar o telefone de forma normalizada. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export async function listCustomers(): Promise<Customer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

/**
 * Busca para autocomplete: casa por Nome OU Código (case-insensitive), retorna
 * no máximo `limit` itens. Vazio devolve os primeiros por nome (para já sugerir
 * algo assim que o campo recebe foco).
 */
export async function searchCustomers(
  term: string,
  limit = 8,
): Promise<Customer[]> {
  const supabase = createClient();
  const q = term.trim();

  let query = supabase.from("customers").select(CUSTOMER_COLUMNS);
  if (q.length > 0) {
    // ilike com % dos dois lados; combina nome OU código.
    const like = `%${q}%`;
    query = query.or(`name.ilike.${like},code.ilike.${like}`);
  }
  const { data, error } = await query
    .order("name", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toCustomer);
}

/**
 * Gera o próximo código no padrão CLI-0001. Lê o maior código existente e
 * incrementa. Como o código também é validado por índice único no banco, uma
 * corrida entre dois cadastros simultâneos é resolvida com uma tentativa extra
 * em createCustomer.
 */
export async function nextCustomerCode(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("code")
    .ilike("code", "CLI-%")
    .order("code", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  let next = 1;
  const current = data?.code as string | undefined;
  if (current) {
    const n = parseInt(current.replace(/\D/g, ""), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `CLI-${String(next).padStart(4, "0")}`;
}

export interface CustomerInput {
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
}

/**
 * Cria um cliente. Se o código colidir (23505 = unique_violation), tenta uma
 * vez com o próximo código livre — cobre corrida entre dois cadastros.
 */
export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const supabase = createClient();

  const attempt = async (code: string) =>
    supabase
      .from("customers")
      .insert({
        code,
        name: input.name,
        phone: input.phone ? digitsOnly(input.phone) : null,
        address: input.address,
      })
      .select(CUSTOMER_COLUMNS)
      .single();

  let { data, error } = await attempt(input.code);

  // Código duplicado: regenera e tenta mais uma vez.
  if (error && error.code === "23505") {
    const fresh = await nextCustomerCode();
    ({ data, error } = await attempt(fresh));
  }
  if (error) throw error;
  if (!data) throw new Error("Falha ao criar o cliente.");
  return toCustomer(data);
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "code" | "name" | "phone" | "address">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined)
    row.phone = patch.phone ? digitsOnly(patch.phone) : null;
  if (patch.address !== undefined) row.address = patch.address;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("customers").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}
