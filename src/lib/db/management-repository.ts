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

export async function createUser(input: {
  fullName: string;
  birthDate: string | null;
  role: Role;
}): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    fullName: input.fullName,
    birthDate: input.birthDate,
    role: input.role,
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.users.put(user);
  return user;
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
