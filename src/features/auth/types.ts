import type { Role } from "@/types/domain";

/**
 * Retrato da sessão — tudo o que o cliente precisa saber sobre quem está
 * logado, num objeto simples (serializável de Server Component para Client
 * Component, e gravável direto no cache do TanStack Query).
 *
 * Vive num arquivo NEUTRO de propósito: o servidor monta este objeto
 * (`session-snapshot.ts`, com `server-only`) e o cliente o consome
 * (`use-auth.ts`, com `"use client"`). Se o tipo morasse em qualquer um dos
 * dois, o outro lado importaria um módulo do ambiente errado.
 */
export interface SessionSnapshot {
  userId: string | null;
  fullName: string | null;
  username: string | null;
  photoUrl: string | null;
  role: Role;
  /** Loja do usuário. null = admin global (todas as lojas). */
  storeId: string | null;
  /** Nome da loja da sessão (vendedora/lojista). null para admin global. */
  storeName: string | null;
  /** Foto/logotipo da loja da sessão. null quando a loja não tem foto. */
  storeLogoUrl: string | null;
}

/**
 * Sessão vazia — o que se devolve quando não há ninguém logado.
 *
 * ATENÇÃO: este objeto NÃO pode ser gravado no cache como se fosse uma
 * resposta válida. `role: "vendedora"` aqui é só um piso seguro para a
 * tipagem; tratado como sessão real, ele rebaixa admin e lojista a vendedora
 * na tela inteira. Quem decide se um retrato é utilizável é `isSignedIn`.
 */
export const ANONYMOUS_SESSION: SessionSnapshot = {
  userId: null,
  fullName: null,
  username: null,
  photoUrl: null,
  role: "vendedora",
  storeId: null,
  storeName: null,
  storeLogoUrl: null,
};

/** true quando o retrato corresponde a alguém de fato autenticado. */
export function isSignedIn(
  snapshot: SessionSnapshot | undefined | null,
): snapshot is SessionSnapshot {
  return Boolean(snapshot?.userId);
}
