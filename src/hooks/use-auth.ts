"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { db } from "@/lib/db/dexie";
import {
  getLocalUserId,
  clearLocalUserId,
} from "@/lib/auth/local-session";
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
 * Current session + role. In local-only mode (no Supabase) it returns "admin"
 * so every feature is usable in development. With Supabase configured, it reads
 * the profile row for the real role.
 *
 * Access rules (per spec):
 * - vendedora: no Relatórios, no Gestão.
 * - lojista: everything except adding products to stock.
 * - admin: full access, including stock additions.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    loading: true,
    userId: null,
    email: null,
    fullName: null,
    photoUrl: null,
    role: "admin",
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Modo local: o usuário é resolvido a partir da sessão local + Dexie,
      // no efeito abaixo. Aqui apenas encerramos o loading.
      setState((s) => ({ ...s, loading: false }));
      return;
    }

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

      // Se a leitura do profile falhar (RLS, rede, etc.), o app cairia no
      // fallback "vendedora" silenciosamente. Logamos para diagnóstico e
      // mantemos o usuário informado via console em vez de mascarar o erro.
      if (error) {
        console.error("[useAuth] Falha ao ler profile:", error.message);
      }
      if (!profile) {
        console.warn(
          "[useAuth] Profile não encontrado para o usuário",
          user.id,
          "— verifique se o bootstrap criou a linha em profiles.",
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

  // Modo local: acompanha o usuário selecionado no login (sessão local) contra
  // a lista viva de usuários no Dexie. Fora do modo local, isto é ignorado.
  const localUsers = useLiveQuery(() => db.users.toArray(), []);

  useEffect(() => {
    if (isSupabaseConfigured() || localUsers === undefined) return;
    const localId = getLocalUserId();
    const current =
      (localId && localUsers.find((u) => u.id === localId)) ||
      localUsers.find((u) => u.role === "admin") ||
      localUsers[0] ||
      null;

    setState({
      loading: false,
      userId: current?.id ?? null,
      email: null,
      fullName: current?.fullName ?? null,
      photoUrl: current?.photoUrl ?? null,
      role: current?.role ?? "admin",
    });
  }, [localUsers]);

  const { role } = state;

  // Derived permissions.
  const canSeeReports = role === "lojista" || role === "admin";
  const canSeeManagement = role === "lojista" || role === "admin";
  const canAddProducts = role === "admin"; // only admin adds stock
  const canEditProducts = role === "lojista" || role === "admin";
  const canRefund = role === "lojista" || role === "admin";

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await createClient().auth.signOut();
    } else {
      // Modo local: encerra a sessão local (seletor de perfil).
      clearLocalUserId();
    }
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