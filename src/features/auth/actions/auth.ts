"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { lucia } from "@/lib/auth/lucia";
import { db } from "@/lib/db/kysely";
import { verifyPassword } from "@/lib/auth/password";
import { getCurrentSession } from "@/lib/auth/session";
import { loadSessionSnapshot } from "@/features/auth/session-snapshot";
import type { SessionSnapshot } from "@/features/auth/types";

/** Resultado do login: erro para exibir, ou sinal verde para navegar. */
export type LoginResult = { error: string } | { ok: true };

/**
 * Login por username puro (sem o e-mail interno do Supabase). Valida a senha
 * (Argon2) contra profiles.password_hash, cria a sessão Lucia e grava o cookie.
 *
 * Retorna erro genérico (não revela se o usuário existe) e nunca vaza detalhe.
 *
 * ## Por que NÃO chamamos `redirect("/pos")` aqui
 *
 * `redirect()` dentro de uma Server Action faz o roteador do Next navegar do
 * lado do cliente — sem recarregar o documento. O `QueryClient` do TanStack
 * vive no layout raiz, que é o mesmo para `/login` e para `/pos`, então ele
 * SOBREVIVE a essa navegação com tudo o que tinha dentro. E o que ele tinha
 * dentro era o retrato da sessão buscado enquanto a tela de login ainda estava
 * aberta: userId null, `role: "vendedora"`, gravado como sucesso e fresco por
 * cinco minutos. Depois de entrar, todo consumidor de `useAuth()` lia esse
 * valor: sem seletor de loja, sem lista de lojas, telas de admin dizendo
 * "apenas administradores". O `Ctrl+Shift+R` "resolvia" porque destruía o
 * cache em memória junto com a página.
 *
 * Devolvendo `{ ok: true }`, quem navega é o cliente — com um carregamento de
 * documento de verdade, que garante um `QueryClient` novo, já com o cookie de
 * sessão no lugar. O `Set-Cookie` desta resposta chega ao navegador antes,
 * porque foi gravado antes do retorno.
 */
export async function loginAction(
  _prev: unknown,
  formData: FormData,
): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Informe usuário e senha." };
  }

  // Busca o usuário por username. Sem escopo de loja: é anterior à sessão,
  // então roda fora de withUser.
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

  return { ok: true };
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

/**
 * Retrato da sessão para o cliente. O primeiro render já vem semeado pelo
 * layout de `(app)` (ver `session-snapshot.ts`); esta action serve as
 * revalidações posteriores — foco de janela, reconexão, expiração do
 * `staleTime`.
 */
export async function me(): Promise<SessionSnapshot> {
  return loadSessionSnapshot();
}
