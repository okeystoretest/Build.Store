import { createClient } from "@/lib/supabase/client";

/**
 * Configurações globais da loja (tabela `settings`, chave/valor). Online-only:
 * lê e escreve direto no Supabase.
 */

const STORE_NAME_KEY = "store_name";
export const DEFAULT_STORE_NAME = "Build.Store";

export async function getStoreName(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", STORE_NAME_KEY)
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value as string | null) ?? "";
  return value.trim() || DEFAULT_STORE_NAME;
}

export async function setStoreName(name: string): Promise<void> {
  const supabase = createClient();
  const value = name.trim() || DEFAULT_STORE_NAME;
  const { error } = await supabase
    .from("settings")
    .upsert({ key: STORE_NAME_KEY, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
