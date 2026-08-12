"use client";

import { useEffect, useState, useCallback } from "react";
import { me, logoutAction } from "@/features/auth/actions/auth";
import type { Role } from "@/types/domain";

export interface AuthState {
  loading: boolean;
  userId: string | null;
  fullName: string | null;
  photoUrl: string | null;
  role: Role;
  /** Loja do usuário. null = admin global (todas as lojas). */
  storeId: string | null;
}

/**
 * Sessão atual + papel, resolvidos pela auth própria (Lucia) via a server action
 * me(). O middleware protege as rotas por cookie; aqui buscamos o profile para
 * papel, nome e foto.
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
    fullName: null,
    photoUrl: null,
    role: "vendedora",
    storeId: null,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await me();
        if (!active) return;
        setState({
          loading: false,
          userId: res.userId,
          fullName: res.fullName,
          photoUrl: res.photoUrl,
          role: res.role,
          storeId: res.storeId,
        });
      } catch {
        if (active) setState((s) => ({ ...s, loading: false }));
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
  const isAdmin = role === "admin";
  const canUploadShowcase = role === "admin"; // só admin envia mídia na Vitrine

  const signOut = useCallback(async () => {
    await logoutAction();
    // logoutAction faz redirect no servidor; fallback client:
    window.location.href = "/login";
  }, []);

  return {
    ...state,
    canSeeReports,
    canSeeManagement,
    canAddProducts,
    canEditProducts,
    canRefund,
    isAdmin,
    canUploadShowcase,
    signOut,
  };
}
