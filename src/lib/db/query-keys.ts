/**
 * Chaves de cache do TanStack Query, num lugar só.
 *
 * As mutações invalidam estas chaves para atualizar a tela na hora; o Realtime
 * (ver hooks) também as invalida quando outro dispositivo altera algo. Manter
 * as chaves centralizadas evita divergência entre quem lê e quem invalida.
 */
export const queryKeys = {
  products: ["products"] as const,
  orders: ["orders"] as const,
  users: ["users"] as const,
  campaigns: ["campaigns"] as const,
  goals: ["goals"] as const,
  notifications: ["notifications"] as const,
};
