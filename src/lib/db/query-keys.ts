/**
 * Chaves de cache do TanStack Query, num lugar só.
 *
 * As mutações invalidam estas chaves para atualizar a tela na hora; o Realtime
 * (ver hooks) também as invalida quando outro dispositivo altera algo. Manter
 * as chaves centralizadas evita divergência entre quem lê e quem invalida.
 */
export const queryKeys = {
  /**
   * Retrato da sessão. Chave ÚNICA no app inteiro: é semeada no servidor pelo
   * layout de `(app)` e lida por todo consumidor de `useAuth()`. Fica aqui, e
   * não dentro do hook cliente, porque o Server Component que semeia o cache
   * também precisa dela.
   */
  auth: ["auth", "me"] as const,
  stores: ["stores"] as const,
  products: ["products"] as const,
  orders: ["orders"] as const,
  users: ["users"] as const,
  campaigns: ["campaigns"] as const,
  goals: ["goals"] as const,
  notifications: ["notifications"] as const,
  settings: ["settings"] as const,
  customers: ["customers"] as const,
  showcase: ["showcase"] as const,
};
