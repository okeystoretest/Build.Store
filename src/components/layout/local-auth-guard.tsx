"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/sync/transport";
import { getLocalUserId } from "@/lib/auth/local-session";

/**
 * Guarda de rota para o modo local. Quando o Supabase está configurado, a
 * proteção é feita pelo middleware (sessão via cookie), então este componente
 * apenas renderiza os filhos. Em modo local, exige uma sessão local; sem ela,
 * redireciona para /login.
 */
export function LocalAuthGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (isSupabaseConfigured()) {
      setAllowed(true);
      return;
    }
    if (getLocalUserId()) {
      setAllowed(true);
    } else {
      window.location.href = "/login";
    }
  }, []);

  if (!allowed) return null;
  return <>{children}</>;
}
