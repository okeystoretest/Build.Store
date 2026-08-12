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
  photoUrl: string | null;
  role: "vendedora" | "lojista" | "admin";
  storeId: string | null;
}

/**
 * Retorna o perfil do usuário logado a partir da sessão Lucia. Usado pelo hook
 * client useAuth. Sem sessão → userId null (o middleware já redireciona, mas o
 * hook trata graciosamente).
 */
export async function me(): Promise<MeResult> {
  const { user } = await getCurrentSession();
  if (!user) {
    return {
      userId: null,
      fullName: null,
      photoUrl: null,
      role: "vendedora",
      storeId: null,
    };
  }
  return {
    userId: user.id,
    fullName: user.fullName ?? null,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    storeId: user.storeId ?? null,
  };
}
