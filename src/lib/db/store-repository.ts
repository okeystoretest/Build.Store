import { createClient } from "@/lib/supabase/client";
import { STORE_COLUMNS, toStore } from "@/lib/db/mappers";
import type { Store } from "@/types/domain";

/**
 * Store repository — CRUD de lojas (tenants). Online-only, direto no Supabase.
 *
 * Acesso: as escritas são protegidas por RLS (só admin cria/edita/exclui — ver
 * migração 0004, policy stores_admin_write). A leitura é liberada a todos os
 * autenticados para montar nomes/logos; o isolamento real está nos dados.
 *
 * Exclusão é HARD-DELETE: remover a loja apaga em cascata todos os dados dela
 * (store_id ... on delete cascade). A confirmação dupla fica na UI.
 */

export async function listStores(): Promise<Store[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stores")
    .select(STORE_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toStore);
}

export async function createStore(input: {
  name: string;
  logoUrl?: string | null;
}): Promise<Store> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stores")
    .insert({ name: input.name, logo_url: input.logoUrl ?? null })
    .select(STORE_COLUMNS)
    .single();
  if (error) throw error;
  return toStore(data);
}

export async function updateStore(
  id: string,
  patch: Partial<Pick<Store, "name" | "logoUrl" | "active">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("stores").update(row).eq("id", id);
  if (error) throw error;
}

/**
 * HARD-DELETE: apaga a loja. Todos os dados com este store_id são removidos em
 * cascata pelo banco (on delete cascade). Irreversível — a UI exige confirmação
 * dupla (digitar o nome da loja) antes de chamar.
 */
export async function deleteStore(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) throw error;
}
