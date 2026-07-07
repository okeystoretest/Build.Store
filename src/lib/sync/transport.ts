import type { Order, Product } from "@/types/domain";

/**
 * The seam between local persistence and the backend.
 * The active binding is chosen at the bottom of this file based on whether
 * Supabase credentials are configured — so the app runs fully offline in
 * development and switches to the real backend in production without touching
 * any feature or repository.
 */
export interface SyncTransport {
  /** Push a locally-created or updated order to the backend. */
  pushOrder(order: Order): Promise<void>;
  /** Push authoritative product state (e.g. after a manual adjustment). */
  pushProduct(product: Product): Promise<void>;
  /** Pull products changed on the server since the given ISO timestamp. */
  pullProducts(since: string | null): Promise<Product[]>;
}

/**
 * Local-only transport. Accepts everything and returns nothing to pull, so the
 * app runs fully offline while keeping the sync pipeline exercised.
 */
export class NullTransport implements SyncTransport {
  async pushOrder(_order: Order): Promise<void> {}
  async pushProduct(_product: Product): Promise<void> {}
  async pullProducts(_since: string | null): Promise<Product[]> {
    return [];
  }
}

/** True when Supabase env vars are present at build/runtime. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Active transport binding. Lazily constructs the Supabase transport only when
 * configured (avoids importing the client in a purely-local dev run) and falls
 * back to NullTransport otherwise.
 */
function resolveTransport(): SyncTransport {
  if (isSupabaseConfigured()) {
    // Deferred require keeps the Supabase client out of the bundle path when
    // it isn't configured, and avoids a circular import at module load.
    const { SupabaseTransport } =
      require("@/lib/sync/supabase-transport") as typeof import("@/lib/sync/supabase-transport");
    return new SupabaseTransport();
  }
  return new NullTransport();
}

export const transport: SyncTransport = resolveTransport();
