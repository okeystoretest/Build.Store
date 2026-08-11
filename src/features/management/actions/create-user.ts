"use server";

import { createClient as createSsrClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth/username";
import type { Role } from "@/types/domain";

/**
 * Provisiona um usuário real: cria o usuário no Supabase Auth (e-mail derivado
 * do username) e sua linha em `profiles`, com vínculo de loja (multi-tenant).
 *
 * Regras de vínculo (enforcement no servidor, não só na UI):
 *  - Admin: pode criar em qualquer loja; escolhe `storeId`. Se role=admin, o
 *    novo usuário é global (store_id = null).
 *  - Lojista: só cria usuários NÃO-admin, e sempre presos à PRÓPRIA loja — o
 *    `storeId` recebido é ignorado e substituído pela loja do lojista.
 *
 * Roda só no servidor com a service-role key — o cliente nunca a vê.
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { ok: false, error: "Supabase não configurado no servidor." };
  }

  // Verifica a permissão do chamador pelo próprio profile (SSR client, RLS-safe).
  const ssr = createSsrClient();
  const {
    data: { user: caller },
  } = await ssr.auth.getUser();
  if (!caller) return { ok: false, error: "Sessão inválida." };

  const { data: callerProfile } = await ssr
    .from("profiles")
    .select("role, store_id")
    .eq("id", caller.id)
    .single();

  if (!callerProfile) return { ok: false, error: "Perfil não encontrado." };
  if (callerProfile.role !== "lojista" && callerProfile.role !== "admin") {
    return { ok: false, error: "Sem permissão para cadastrar usuários." };
  }

  // Resolve a loja do novo usuário conforme o papel do chamador.
  let targetStoreId: string | null;
  if (callerProfile.role === "admin") {
    // Admin escolhe; usuário admin é global (sem loja).
    targetStoreId = input.role === "admin" ? null : (input.storeId ?? null);
    if (input.role !== "admin" && !targetStoreId) {
      return { ok: false, error: "Selecione a loja do usuário." };
    }
  } else {
    // Lojista: nunca cria admin; sempre na própria loja.
    if (input.role === "admin") {
      return { ok: false, error: "Lojista não pode criar usuário Admin." };
    }
    if (!callerProfile.store_id) {
      return { ok: false, error: "Seu usuário não está vinculado a uma loja." };
    }
    targetStoreId = callerProfile.store_id as string;
  }

  // Admin client (service role) — bypassa RLS para criar auth user + profile.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = usernameToEmail(input.username);

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username: input.username,
      full_name: input.fullName,
      role: input.role,
      store_id: targetStoreId ?? "",
    },
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message ?? "Falha ao criar credenciais." };
  }

  const authId = created.user.id;

  // O trigger handle_new_user() já cria a linha em profiles. Fazemos um upsert
  // para preencher os campos completos (birth_date, photo, role, store).
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: authId,
    username: input.username,
    full_name: input.fullName,
    birth_date: input.birthDate,
    role: input.role,
    photo_url: input.photoUrl ?? null,
    store_id: targetStoreId,
    active: true,
  });

  if (profileErr) {
    // Desfaz o auth user órfão para o username continuar reutilizável.
    await admin.auth.admin.deleteUser(authId);
    return { ok: false, error: profileErr.message };
  }

  return { ok: true, authId };
}
