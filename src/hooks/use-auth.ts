"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import type { Role } from "@/types/domain";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
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
    role: "admin",
  });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      if (active) {
        setState({
          loading: false,
          userId: user.id,
          email: user.email ?? null,
          fullName: profile?.full_name ?? null,
          role: (profile?.role as Role) ?? "vendedora",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const { role } = state;

  // Derived permissions.
  const canSeeReports = role === "lojista" || role === "admin";
  const canSeeManagement = role === "lojista" || role === "admin";
  const canAddProducts = role === "admin"; // only admin adds stock
  const canEditProducts = role === "lojista" || role === "admin";
  const canRefund = role === "lojista" || role === "admin";

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
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
