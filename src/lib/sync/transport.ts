import type { Order, Product, User, Campaign, Goal } from "@/types/domain";

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
  /** Delete a product from the backend. */
  deleteProduct(id: string): Promise<void>;
  /** Push (upsert) a campaign. */
  pushCampaign(campaign: Campaign): Promise<void>;
  /** Delete a campaign from the backend. */
  deleteCampaign(id: string): Promise<void>;
  /** Push (upsert) a seller goal. */
  pushGoal(goal: Goal): Promise<void>;
  /** Delete a goal from the backend. */
  deleteGoal(id: string): Promise<void>;
  /** Push profile edits (full_name, role, photo, active, birth date). */
  pushUserUpdate(
    id: string,
    patch: Partial<Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">>,
  ): Promise<void>;
  /** Pull products changed on the server since the given ISO timestamp. */
  pullProducts(since: string | null): Promise<Product[]>;
  /** Pull every order (with items) for the caller's store. */
  pullOrders(): Promise<Order[]>;
  /** Pull users/sellers (profiles) for the caller's store. */
  pullUsers(): Promise<User[]>;
  /** Pull campaigns for the caller's store. */
  pullCampaigns(): Promise<Campaign[]>;
  /** Pull seller goals for the caller's store. */
  pullGoals(): Promise<Goal[]>;
}

/**
 * Local-only transport. Accepts everything and returns nothing to pull, so the
 * app runs fully offline while keeping the sync pipeline exercised.
 */
export class NullTransport implements SyncTransport {
  async pushOrder(_order: Order): Promise<void> {}
  async pushProduct(_product: Product): Promise<void> {}
  async deleteProduct(_id: string): Promise<void> {}
  async pushCampaign(_campaign: Campaign): Promise<void> {}
  async deleteCampaign(_id: string): Promise<void> {}
  async pushGoal(_goal: Goal): Promise<void> {}
  async deleteGoal(_id: string): Promise<void> {}
  async pushUserUpdate(
    _id: string,
    _patch: Partial<Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">>,
  ): Promise<void> {}
  async pullProducts(_since: string | null): Promise<Product[]> {
    return [];
  }
  async pullOrders(): Promise<Order[]> {
    return [];
  }
  async pullUsers(): Promise<User[]> {
    return [];
  }
  async pullCampaigns(): Promise<Campaign[]> {
    return [];
  }
  async pullGoals(): Promise<Goal[]> {
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
