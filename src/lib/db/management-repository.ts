import { db } from "@/lib/db/dexie";
import type {
  User,
  Campaign,
  Goal,
  Role,
  GoalType,
} from "@/types/domain";

/**
 * Management repository — users (incl. sellers), campaigns and goals.
 * Dexie-backed so all of Gestão/Dashboard works offline; Supabase sync mirrors
 * these via the transport in production.
 */

/** Default campaign commission rate applied per sale (2.5%). */
export const CAMPAIGN_COMMISSION_RATE = 0.025;

// --- Users -----------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  return db.users.orderBy("fullName").toArray();
}

/** Sellers are users with the "vendedora" role. */
export async function listSellers(): Promise<User[]> {
  const all = await db.users.where("role").equals("vendedora").toArray();
  return all.filter((u) => u.active).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Create a user.
 *
 * - Local/demo mode (no Supabase): stored in Dexie only, with a generated id.
 *   The password is ignored — there is no auth backend to hold it.
 * - Real mode (Supabase configured): a `storeId` is required and the caller is
 *   expected to have created the auth user first (see createAuthUser), passing
 *   the resulting auth id in `authId`. The Dexie row mirrors the profile.
 *
 * `username` is unique; it maps to the login email via usernameToEmail().
 */
export async function createUser(input: {
  username: string;
  fullName: string;
  birthDate: string | null;
  role: Role;
  photoUrl?: string | null;
  authId?: string;
}): Promise<User> {
  const existing = await db.users.where("username").equals(input.username).first();
  if (existing) {
    throw new Error(`Usuário "${input.username}" já existe`);
  }
  const user: User = {
    id: input.authId ?? crypto.randomUUID(),
    username: input.username,
    fullName: input.fullName,
    birthDate: input.birthDate,
    role: input.role,
    photoUrl: input.photoUrl ?? null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.users.put(user);
  return user;
}

/** Atualiza campos editáveis de um usuário. */
export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">>,
): Promise<void> {
  await db.users.update(id, patch);
}

/** Remove um usuário do cadastro local. */
export async function deleteUser(id: string): Promise<void> {
  await db.users.delete(id);
}

// --- Campaigns -------------------------------------------------------------

export async function listCampaigns(): Promise<Campaign[]> {
  return db.campaigns.orderBy("name").toArray();
}

export async function listActiveCampaigns(): Promise<Campaign[]> {
  const all = await db.campaigns.toArray();
  return all.filter((c) => c.active).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCampaign(name: string): Promise<Campaign> {
  const campaign: Campaign = {
    id: crypto.randomUUID(),
    name,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.campaigns.put(campaign);
  return campaign;
}

export async function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "name" | "active">>,
): Promise<void> {
  await db.campaigns.update(id, patch);
}

export async function deleteCampaign(id: string): Promise<void> {
  await db.campaigns.delete(id);
}

// --- Goals -----------------------------------------------------------------

export async function listGoals(): Promise<Goal[]> {
  return db.goals.toArray();
}

export async function goalsForSeller(sellerId: string): Promise<Goal[]> {
  return db.goals.where("sellerId").equals(sellerId).toArray();
}

/**
 * Create a goal. "general" goals carry a monetary target (cents); "campaign"
 * goals carry an item-quantity target and a campaign reference. Multiple goals
 * per seller are allowed.
 */
export async function createGoal(input: {
  sellerId: string;
  type: GoalType;
  campaignId: string | null;
  targetCents: number | null;
  targetQuantity: number | null;
}): Promise<Goal> {
  const goal: Goal = {
    id: crypto.randomUUID(),
    sellerId: input.sellerId,
    type: input.type,
    campaignId: input.type === "campaign" ? input.campaignId : null,
    targetCents: input.type === "general" ? input.targetCents : null,
    targetQuantity: input.type === "campaign" ? input.targetQuantity : null,
    createdAt: new Date().toISOString(),
  };
  await db.goals.put(goal);
  return goal;
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, "type" | "campaignId" | "targetCents" | "targetQuantity">>,
): Promise<void> {
  await db.goals.update(id, patch);
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}
