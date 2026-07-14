"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types/domain";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  photoUrl: string | null;
  role: Role;
}

/**
 * Sessão atual + papel, lidos do Supabase (online-only). O middleware já
 * protege as rotas por cookie; aqui resolvemos o profile para papel, nome e
 * foto.
 *
 * Regras de acesso (por spec):
 * - vendedora: sem Relatórios, sem Gestão.
 * - lojista: tudo, exceto adicionar produtos ao estoque.
 * - admin: acesso total, incluindo adicionar estoque.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    fullName: null,
    photoUrl: null,
    role: "vendedora",
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setState((s) => ({ ...s, loading: false }));
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("full_name, role, photo_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[useAuth] Falha ao ler profile:", error.message);
      }
      if (!profile) {
        console.warn(
          "[useAuth] Profile não encontrado para o usuário",
          user.id,
          "— verifique se o trigger handle_new_user criou a linha em profiles.",
        );
      }

      if (active) {
        setState({
          loading: false,
          userId: user.id,
          email: user.email ?? null,
          fullName: profile?.full_name ?? null,
          photoUrl: (profile?.photo_url as string | null) ?? null,
          role: (profile?.role as Role) ?? "vendedora",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const { role } = state;

  // Permissões derivadas.
  const canSeeReports = role === "lojista" || role === "admin";
  const canSeeManagement = role === "lojista" || role === "admin";
  const canAddProducts = role === "admin"; // só admin adiciona estoque
  const canEditProducts = role === "lojista" || role === "admin";
  const canRefund = role === "lojista" || role === "admin";

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }, []);

  return {
    ...state,
    canSeeReports,
    canSeeManagement,
    canAddProducts,
    canEditProducts,
    canRefund,
    signOut,
  };
}
