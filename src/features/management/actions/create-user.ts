"use server";

import { createClient as createSsrClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth/username";
import type { Role } from "@/types/domain";

/**
 * Provision a real user: creates the Supabase Auth user (email derived from the
 * username) and its profile row, scoped to the caller's store. Runs only on the
 * server with the service-role key — the client never sees it.
 *
 * Returns the new auth id so the local Dexie mirror can reuse it, keeping the
 * offline copy and the remote profile in sync (same primary key).
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

  // Resolve the caller's store from their own profile (RLS-safe SSR client).
  const ssr = createSsrClient();
  const {
    data: { user: caller },
  } = await ssr.auth.getUser();
  if (!caller) return { ok: false, error: "Sessão inválida." };

  const { data: callerProfile } = await ssr
    .from("profiles")
    .select("store_id, role")
    .eq("id", caller.id)
    .single();

  if (!callerProfile) return { ok: false, error: "Perfil não encontrado." };
  if (callerProfile.role !== "lojista" && callerProfile.role !== "admin") {
    return { ok: false, error: "Sem permissão para cadastrar usuários." };
  }
  const storeId = callerProfile.store_id as string;

  // Admin client (service role) — bypasses RLS to create the auth user + profile.
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = usernameToEmail(input.username);

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { username: input.username, full_name: input.fullName },
  });
  if (authErr || !created.user) {
    return { ok: false, error: authErr?.message ?? "Falha ao criar credenciais." };
  }

  const authId = created.user.id;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: authId,
    store_id: storeId,
    username: input.username,
    full_name: input.fullName,
    birth_date: input.birthDate,
    role: input.role,
    photo_url: input.photoUrl ?? null,
  });

  if (profileErr) {
    // Roll back the orphan auth user so username stays reusable.
    await admin.auth.admin.deleteUser(authId);
    return { ok: false, error: profileErr.message };
  }

  return { ok: true, authId };
}
