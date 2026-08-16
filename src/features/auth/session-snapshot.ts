import "server-only";
import { db } from "@/lib/db/kysely";
import { getCurrentSession } from "@/lib/auth/session";
import { ANONYMOUS_SESSION, type SessionSnapshot } from "@/features/auth/types";

/**
 * Resolução da sessão no SERVIDOR — fonte única de verdade sobre quem está
 * logado.
 *
 * Módulo separado da Server Action `me()` de propósito: assim o layout de
 * `(app)` pode chamar isto durante o render no servidor (e já entregar a
 * página com o papel certo), enquanto `me()` continua existindo como action
 * para as revalidações posteriores do cliente. Um arquivo `"use server"` só
 * pode exportar funções assíncronas, então não daria para pendurar tipos e
 * constantes aqui dentro.
 */

/**
 * Nome e foto da loja da SESSÃO, resolvidos no servidor junto com o perfil.
 *
 * Por que aqui e não apenas no hook `useStoreLogo`: aquele hook depende do
 * `StoreContext`, que por sua vez depende do próprio retrato da sessão. Na
 * primeira renderização depois do login ainda não havia `storeId`, a query
 * saía com `null`, e o resultado nulo ficava no cache sob a chave
 * `[..., null]`. Vendedora e lojista — que nunca trocam de loja — terminavam
 * sem nome e sem foto até um recarregamento manual.
 *
 * A leitura usa o pool sem escopo (`db`) de propósito: o filtro é o `store_id`
 * que veio da sessão já validada pelo Lucia, então não há como vazar dado de
 * outra loja, e a identidade visual deixa de depender das políticas de RLS —
 * uma política restritiva em `settings`/`stores` derrubava nome e foto juntos.
 */
async function loadStoreIdentity(
  storeId: string,
): Promise<{ storeName: string | null; storeLogoUrl: string | null }> {
  try {
    const [loja, config] = await Promise.all([
      db
        .selectFrom("stores")
        .select(["name", "logo_url"])
        .where("id", "=", storeId)
        .executeTakeFirst(),
      db
        .selectFrom("settings")
        .select(["key", "value"])
        .where("store_id", "=", storeId)
        .where("key", "in", ["store_name", "store_logo"])
        .execute(),
    ]);

    const porChave = new Map(
      config.map((r) => [r.key, ((r.value as string | null) ?? "").trim()]),
    );
    const nome = (porChave.get("store_name") || loja?.name || "").trim();
    const logo = (porChave.get("store_logo") || loja?.logo_url || "").trim();

    return { storeName: nome || null, storeLogoUrl: logo || null };
  } catch {
    // Identidade visual é acessório: falha aqui não pode derrubar a sessão.
    return { storeName: null, storeLogoUrl: null };
  }
}

/**
 * Perfil do usuário logado a partir da sessão Lucia, já com os dados da loja
 * vinculada. Sem sessão → `ANONYMOUS_SESSION` (userId null).
 */
export async function loadSessionSnapshot(): Promise<SessionSnapshot> {
  const { user } = await getCurrentSession();
  if (!user) return ANONYMOUS_SESSION;

  const storeId = user.storeId ?? null;
  const { storeName, storeLogoUrl } = storeId
    ? await loadStoreIdentity(storeId)
    : { storeName: null, storeLogoUrl: null };

  return {
    userId: user.id,
    fullName: user.fullName ?? null,
    username: user.username ?? null,
    // Foto individual quando houver; senão a da loja (propagação da sessão 6).
    photoUrl: user.photoUrl ?? storeLogoUrl,
    role: user.role,
    storeId,
    storeName,
    storeLogoUrl,
  };
}
