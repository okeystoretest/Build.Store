"use server";

import { randomUUID } from "crypto";
import { db, withUser } from "@/lib/db/kysely";
import { getCurrentSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@/types/domain";

/**
 * Provisiona um usuário: cria a linha em `profiles` com hash Argon2 da senha.
 * Auth própria (sem Supabase Admin API). O vínculo de loja segue as regras de
 * multi-tenant:
 *   - Admin: cria em qualquer loja; role=admin => global (store_id null).
 *   - Lojista: só cria NÃO-admin, e sempre na própria loja.
 *
 * A permissão é verificada pela sessão do chamador. A escrita roda dentro de
 * withUser(caller) para a RLS validar (defesa em profundidade além da checagem
 * explícita abaixo).
 */
export async function createUserAction(input: {
  username: string;
  password: string;
  fullName: string;
  birthDate: string | null;
  role: Role;
  photoUrl?: string | null;
  storeId?: string | null;
}): Promise<{ ok: true; authId: string } | { ok: false; error: string }> {
  const { user: caller } = await getCurrentSession();
  if (!caller) return { ok: false, error: "Sessão inválida." };
  if (caller.role !== "lojista" && caller.role !== "admin") {
    return { ok: false, error: "Sem permissão para cadastrar usuários." };
  }

  // Resolve a loja do novo usuário conforme o papel do chamador.
  let targetStoreId: string | null;
  if (caller.role === "admin") {
    targetStoreId = input.role === "admin" ? null : (input.storeId ?? null);
    if (input.role !== "admin" && !targetStoreId) {
      return { ok: false, error: "Selecione a loja do usuário." };
    }
  } else {
    if (input.role === "admin") {
      return { ok: false, error: "Lojista não pode criar usuário Admin." };
    }
    if (!caller.storeId) {
      return { ok: false, error: "Seu usuário não está vinculado a uma loja." };
    }
    targetStoreId = caller.storeId;
  }

  const username = input.username.trim();

  // Username único (case-insensitive).
  const existing = await db
    .selectFrom("profiles")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();
  if (existing) {
    return { ok: false, error: "Nome de usuário já existe." };
  }

  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);

  try {
    await withUser(caller.id, async (trx) => {
      await trx
        .insertInto("profiles")
        .values({
          id,
          username,
          full_name: input.fullName,
          birth_date: input.birthDate,
          role: input.role,
          photo_url: input.photoUrl ?? null,
          store_id: targetStoreId,
          password_hash: passwordHash,
          active: true,
          created_at: new Date().toISOString(),
        })
        .execute();
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Falha ao cadastrar usuário.",
    };
  }

  return { ok: true, authId: id };
}
