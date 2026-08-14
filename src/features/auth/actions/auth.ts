"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lucia } from "@/lib/auth/lucia";
import { db } from "@/lib/db/kysely";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentSession } from "@/lib/auth/session";

/**
 * Login por username puro (sem o e-mail interno do Supabase). Valida a senha
 * (Argon2) contra profiles.password_hash, cria a sessão Lucia e grava o cookie.
 *
 * Retorna erro genérico (não revela se o usuário existe) e nunca vaza detalhe.
 */
export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ error: string } | void> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Informe usuário e senha." };
  }

  // Busca o usuário por username (case-insensitive). Sem escopo de loja: é
  // anterior à sessão, então roda fora de withUser.
  const user = await db
    .selectFrom("profiles")
    .select(["id", "password_hash", "active"])
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user || !user.password_hash || !user.active) {
    return { error: "Não foi possível entrar. Verifique usuário e senha." };
  }

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) {
    return { error: "Não foi possível entrar. Verifique usuário e senha." };
  }

  const session = await lucia.createSession(user.id, {});
  const cookie = lucia.createSessionCookie(session.id);
  cookies().set(cookie.name, cookie.value, cookie.attributes);

  redirect("/pos");
}

/** Logout: invalida a sessão Lucia e limpa o cookie. */
export async function logoutAction(): Promise<void> {
  const { session } = await getCurrentSession();
  if (session) {
    await lucia.invalidateSession(session.id);
  }
  const blank = lucia.createBlankSessionCookie();
  cookies().set(blank.name, blank.value, blank.attributes);
  redirect("/login");
}

export interface MeResult {
  userId: string | null;
  fullName: string | null;
  username: string | null;
  photoUrl: string | null;
  role: "vendedora" | "lojista" | "admin";
  storeId: string | null;
  /** Nome da loja vinculada à sessão. null para admin global. */
  storeName: string | null;
  /** Foto/logotipo da loja vinculada à sessão. null quando não há. */
  storeLogoUrl: string | null;
}

const ANONIMO: MeResult = {
  userId: null,
  fullName: null,
  username: null,
  photoUrl: null,
  role: "vendedora",
  storeId: null,
  storeName: null,
  storeLogoUrl: null,
};

/**
 * Nome e foto da loja da SESSÃO, resolvidos no servidor junto com o perfil.
 *
 * Por que aqui e não apenas no hook `useStoreLogo`: aquele hook depende do
 * `StoreContext`, que por sua vez depende do próprio `me()`. Na primeira
 * renderização depois do login ainda não havia `storeId`, a query saía com
 * `null`, e o resultado nulo ficava no cache sob a chave `[..., null]`.
 * Vendedora e lojista — que nunca trocam de loja — terminavam sem nome e sem
 * foto até um recarregamento manual.
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
 * Retorna o perfil do usuário logado a partir da sessão Lucia, já com os dados
 * da loja vinculada. Usado pelo hook client useAuth. Sem sessão → userId null
 * (o middleware já redireciona, mas o hook trata graciosamente).
 */
export async function me(): Promise<MeResult> {
  const { user } = await getCurrentSession();
  if (!user) return ANONIMO;

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
