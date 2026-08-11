import { createClient } from "@/lib/supabase/client";

/**
 * Configurações da loja (tabela `settings`, chave/valor) — agora POR LOJA.
 *
 * A tabela tem PK composta (key, store_id): cada loja guarda o próprio
 * store_name / store_logo. Toda leitura/escrita exige o storeId da loja alvo.
 * Online-only.
 *
 * Para o admin em modo "todas as lojas" não há uma loja específica; nesse caso
 * a UI cai no DEFAULT_STORE_NAME e não grava (o admin ajusta nome/logo com uma
 * loja selecionada).
 */

const STORE_NAME_KEY = "store_name";
const STORE_LOGO_KEY = "store_logo";
export const DEFAULT_STORE_NAME = "Build.Sales";

export async function getStoreName(storeId: string | null): Promise<string> {
  if (!storeId) return DEFAULT_STORE_NAME;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", STORE_NAME_KEY)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value as string | null) ?? "";
  return value.trim() || DEFAULT_STORE_NAME;
}

export async function setStoreName(
  storeId: string,
  name: string,
): Promise<void> {
  const supabase = createClient();
  const value = name.trim() || DEFAULT_STORE_NAME;
  const { error } = await supabase.from("settings").upsert({
    key: STORE_NAME_KEY,
    store_id: storeId,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/**
 * Logotipo institucional (data URL) exibido no cabeçalho do comprovante
 * impresso. Vazio quando não há logo configurada.
 */
export async function getStoreLogo(
  storeId: string | null,
): Promise<string | null> {
  if (!storeId) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", STORE_LOGO_KEY)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  const value = (data?.value as string | null) ?? "";
  return value.trim() ? value : null;
}

export async function setStoreLogo(
  storeId: string,
  dataUrl: string | null,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("settings").upsert({
    key: STORE_LOGO_KEY,
    store_id: storeId,
    value: dataUrl ?? "",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
