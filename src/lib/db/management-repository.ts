import { createClient } from "@/lib/supabase/client";
import {
  PROFILE_COLUMNS,
  CAMPAIGN_COLUMNS,
  GOAL_COLUMNS,
  toUser,
  toCampaign,
  toGoal,
} from "@/lib/db/mappers";
import type { User, Campaign, Goal, GoalType } from "@/types/domain";

/**
 * Management repository — online-only (users/sellers, campaigns, goals).
 * Tudo direto no Supabase. A criação de usuário com credenciais é feita pela
 * server action createUserAction (service role); aqui ficam as escritas de
 * perfil/campanha/meta que a UI dispara.
 */

/** Comissão padrão por campanha aplicada por venda (2,5%). */
export const CAMPAIGN_COMMISSION_RATE = 0.025;

// --- Users -----------------------------------------------------------------

export async function listUsers(): Promise<User[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toUser);
}

/** Vendedoras: usuários ativos com papel "vendedora". */
export async function listSellers(): Promise<User[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("role", "vendedora")
    .eq("active", true)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toUser);
}

/** Atualiza campos editáveis de um usuário (profile). */
export async function updateUser(
  id: string,
  patch: Partial<Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("profiles").update(row).eq("id", id);
  if (error) throw error;
}

/**
 * "Remove" um usuário: desativa o profile (active=false). Não apagamos a linha
 * de auth.users daqui — isso exige service role e é feito no painel do Supabase
 * se necessário. Desativar já tira a pessoa das listas e do login efetivo.
 */
export async function deleteUser(id: string): Promise<void> {
  await updateUser(id, { active: false });
}

// --- Campaigns -------------------------------------------------------------

export async function listCampaigns(): Promise<Campaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCampaign);
}

export async function listActiveCampaigns(): Promise<Campaign[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(CAMPAIGN_COLUMNS)
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toCampaign);
}

export async function createCampaign(name: string): Promise<Campaign> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({ name, active: true })
    .select(CAMPAIGN_COLUMNS)
    .single();
  if (error) throw error;
  return toCampaign(data);
}

export async function updateCampaign(
  id: string,
  patch: Partial<Pick<Campaign, "name" | "active">>,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCampaign(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

// --- Goals -----------------------------------------------------------------

export async function listGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("goals").select(GOAL_COLUMNS);
  if (error) throw error;
  return (data ?? []).map(toGoal);
}

export async function goalsForSeller(sellerId: string): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("seller_id", sellerId);
  if (error) throw error;
  return (data ?? []).map(toGoal);
}

/**
 * Cria uma meta. "general" carrega alvo monetário (centavos); "campaign"
 * carrega alvo em quantidade de itens + referência de campanha. Várias metas
 * por vendedora são permitidas.
 */
export async function createGoal(input: {
  sellerId: string;
  type: GoalType;
  campaignId: string | null;
  targetCents: number | null;
  targetQuantity: number | null;
}): Promise<Goal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      seller_id: input.sellerId,
      type: input.type,
      campaign_id: input.type === "campaign" ? input.campaignId : null,
      target_cents: input.type === "general" ? input.targetCents : null,
      target_quantity: input.type === "campaign" ? input.targetQuantity : null,
    })
    .select(GOAL_COLUMNS)
    .single();
  if (error) throw error;
  return toGoal(data);
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, "type" | "campaignId" | "targetCents" | "targetQuantity">>,
): Promise<void> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
  if (patch.targetCents !== undefined) row.target_cents = patch.targetCents;
  if (patch.targetQuantity !== undefined)
    row.target_quantity = patch.targetQuantity;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabase.from("goals").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
