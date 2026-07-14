"use server";

import { createClient as createSsrClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth/username";
import type { Role } from "@/types/domain";

/**
 * Provisiona um usuário real: cria o usuário no Supabase Auth (e-mail derivado
 * do username) e sua linha em `profiles`. Arquitetura de loja única — NÃO há
 * `store_id`; todos os usuários compartilham a mesma base global.
 *
 * Roda só no servidor com a service-role key — o cliente nunca a vê. Retorna o
 * id do auth para que o espelho local (Dexie) reutilize a mesma primary key.
 */
export async function createUserAction(input: {
  username: string;
  password: string;
  fullName: string;
  birthDate: string | null;
  role: Role;
  photoUrl?: string | null;
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
    .select("role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile) return { ok: false, error: "Perfil não encontrado." };
  if (callerProfile.role !== "lojista" && callerProfile.role !== "admin") {
    return { ok: false, error: "Sem permissão para cadastrar usuários." };
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
    },
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message ?? "Falha ao criar credenciais." };
  }

  const authId = created.user.id;

  // O trigger handle_new_user() já cria a linha em profiles. Fazemos um upsert
  // para preencher os campos completos (birth_date, photo, role definitivo).
  const { error: profileErr } = await admin.from("profiles").upsert({
    id: authId,
    username: input.username,
    full_name: input.fullName,
    birth_date: input.birthDate,
    role: input.role,
    photo_url: input.photoUrl ?? null,
    active: true,
  });

  if (profileErr) {
    // Desfaz o auth user órfão para o username continuar reutilizável.
    await admin.auth.admin.deleteUser(authId);
    return { ok: false, error: profileErr.message };
  }

  return { ok: true, authId };
}
