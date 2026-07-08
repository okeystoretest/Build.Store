"use client";

/**
 * Sessão local (modo offline, sem Supabase).
 *
 * Quando o Supabase não está configurado, o app ainda precisa de um conceito de
 * "usuário logado" para resolver papel, foto e o botão de logout. Guardamos
 * apenas o id do usuário selecionado no login, persistido em localStorage.
 *
 * Isto NÃO é autenticação segura — é um seletor de perfil para uso local/dev.
 * A segurança real vem do Supabase Auth quando configurado.
 */
const KEY = "bs.localUserId";

export function getLocalUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLocalUserId(id: string): void {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

export function clearLocalUserId(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
