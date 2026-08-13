"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { getCurrentSession } from "@/lib/auth/session";
import { toUser, toCampaign, toGoal } from "@/lib/db/mappers";
import type { User, Campaign, Goal, GoalType } from "@/types/domain";

/**
 * Server Actions de Gestão (usuários/vendedoras, campanhas, metas) — Kysely +
 * RLS por sessão. A criação de usuário com credenciais fica em
 * createUserAction; aqui ficam as demais escritas/leituras.
 *
 * ATENÇÃO — por que existe `exigirGestao()` abaixo:
 *
 * O cadeado da sidebar permite ao admin LIBERAR a tela de Gestão para uma
 * vendedora numa loja específica. Isso é liberação de VISUALIZAÇÃO. Sem uma
 * trava de papel no servidor, essa liberação viraria escalada de privilégio —
 * a vendedora liberada poderia alterar papéis, remover usuários e mexer nas
 * metas que definem a própria comissão.
 *
 * Então: quem enxerga a tela é decidido pelo cadeado; quem ESCREVE continua
 * sendo decidido pelo papel, aqui, no servidor. As duas coisas são separadas
 * de propósito.
 */

/** Escritas de Gestão: só lojista e admin, independentemente do cadeado. */
async function exigirGestao(): Promise<void> {
  const { user } = await getCurrentSession();
  if (!user) throw new Error("Não autenticado.");
  if (user.role !== "lojista" && user.role !== "admin") {
    throw new Error("Sem permissão para esta alteração.");
  }
}

// --- Users -----------------------------------------------------------------

/**
 * Lista os usuários da loja. Só os ATIVOS: remover um usuário é um soft-delete
 * (`active=false`, para não quebrar o vínculo das vendas com a vendedora), e
 * quem foi removido não pode continuar aparecendo na lista.
 */
export async function listUsersAction(
  storeId?: string | null,
): Promise<User[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("profiles").selectAll().where("active", "=", true);
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("full_name", "asc").execute();
    return rows.map((r) => toUser(r as Record<string, unknown>));
  });
}

export async function listSellersAction(
  storeId?: string | null,
): Promise<User[]> {
  return withCurrentUser(async (trx) => {
    let q = trx
      .selectFrom("profiles")
      .selectAll()
      .where("role", "=", "vendedora")
      .where("active", "=", true);
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("full_name", "asc").execute();
    return rows.map((r) => toUser(r as Record<string, unknown>));
  });
}

export async function updateUserAction(
  id: string,
  patch: Partial<
    Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">
  >,
): Promise<void> {
  await exigirGestao();

  const row: Record<string, unknown> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length === 0) return;

  await withCurrentUser(async (trx) => {
    await trx
      .updateTable("profiles")
      .set(row as never)
      .where("id", "=", id)
      .execute();
  });
}

/**
 * Remove um usuário (soft-delete — o `profiles.id` é referenciado por
 * `orders.seller_id`, então apagar a linha derrubaria o histórico de vendas).
 *
 * A remoção faz, numa única transação:
 *   1. `active=false`      → some da lista e o login passa a recusar;
 *   2. `password_hash=null`→ a credencial deixa de existir;
 *   3. libera o `username` (renomeia para `<user>__removido__<sufixo>`), para
 *      que o mesmo nome possa ser cadastrado de novo — o índice de username é
 *      único e antes ficava preso pelo usuário removido;
 *   4. apaga as sessões do Lucia → quem estava logado cai na hora, em vez de
 *      seguir usando o app até a sessão expirar.
 *
 * Ninguém pode remover a si mesmo (evita o admin se trancar para fora).
 */
export async function deleteUserAction(id: string): Promise<void> {
  await exigirGestao();

  await withCurrentUser(async (trx, caller) => {
    if (caller.id === id) {
      throw new Error("Você não pode remover o seu próprio usuário.");
    }

    const target = await trx
      .selectFrom("profiles")
      .select(["username", "active"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!target) throw new Error("Usuário não encontrado.");
    if (!target.active) return; // já removido — nada a fazer

    const suffix = randomUUID().slice(0, 8);
    await trx
      .updateTable("profiles")
      .set({
        active: false,
        password_hash: null,
        username: `${target.username}__removido__${suffix}`,
      } as never)
      .where("id", "=", id)
      .execute();

    await trx.deleteFrom("sessions").where("user_id", "=", id).execute();
  });
}

// --- Campaigns -------------------------------------------------------------

export async function listCampaignsAction(
  storeId?: string | null,
): Promise<Campaign[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("campaigns").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("name", "asc").execute();
    return rows.map((r) => toCampaign(r as Record<string, unknown>));
  });
}

export async function listActiveCampaignsAction(
  storeId?: string | null,
): Promise<Campaign[]> {
  return withCurrentUser(async (trx) => {
    let q = trx
      .selectFrom("campaigns")
      .selectAll()
      .where("active", "=", true);
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("name", "asc").execute();
    return rows.map((r) => toCampaign(r as Record<string, unknown>));
  });
}

export async function createCampaignAction(
  name: string,
  storeId: string,
): Promise<Campaign> {
  await exigirGestao();

  return withCurrentUser(async (trx) => {
    const row = await trx
      .insertInto("campaigns")
      .values({
        id: randomUUID(),
        name,
        active: true,
        store_id: storeId,
        created_at: new Date().toISOString(),
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toCampaign(row as Record<string, unknown>);
  });
}

export async function updateCampaignAction(
  id: string,
  patch: Partial<Pick<Campaign, "name" | "active">>,
): Promise<void> {
  await exigirGestao();
  if (Object.keys(patch).length === 0) return;
  await withCurrentUser(async (trx) => {
    await trx
      .updateTable("campaigns")
      .set(patch as never)
      .where("id", "=", id)
      .execute();
  });
}

export async function deleteCampaignAction(id: string): Promise<void> {
  await exigirGestao();

  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("campaigns").where("id", "=", id).execute();
  });
}

// --- Goals -----------------------------------------------------------------

export async function listGoalsAction(
  storeId?: string | null,
): Promise<Goal[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("goals").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.execute();
    return rows.map((r) => toGoal(r as Record<string, unknown>));
  });
}

export async function goalsForSellerAction(
  sellerId: string,
): Promise<Goal[]> {
  return withCurrentUser(async (trx) => {
    const rows = await trx
      .selectFrom("goals")
      .selectAll()
      .where("seller_id", "=", sellerId)
      .execute();
    return rows.map((r) => toGoal(r as Record<string, unknown>));
  });
}

export async function createGoalAction(input: {
  sellerId: string;
  type: GoalType;
  campaignId: string | null;
  targetCents: number | null;
  targetQuantity: number | null;
  storeId: string;
}): Promise<Goal> {
  await exigirGestao();

  return withCurrentUser(async (trx) => {
    const row = await trx
      .insertInto("goals")
      .values({
        id: randomUUID(),
        seller_id: input.sellerId,
        type: input.type,
        campaign_id: input.type === "campaign" ? input.campaignId : null,
        target_cents: input.type === "general" ? input.targetCents : null,
        target_quantity:
          input.type === "campaign" ? input.targetQuantity : null,
        store_id: input.storeId,
      } as never)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toGoal(row as Record<string, unknown>);
  });
}

export async function updateGoalAction(
  id: string,
  patch: Partial<
    Pick<Goal, "type" | "campaignId" | "targetCents" | "targetQuantity">
  >,
): Promise<void> {
  await exigirGestao();

  const row: Record<string, unknown> = {};
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.campaignId !== undefined) row.campaign_id = patch.campaignId;
  if (patch.targetCents !== undefined) row.target_cents = patch.targetCents;
  if (patch.targetQuantity !== undefined)
    row.target_quantity = patch.targetQuantity;
  if (Object.keys(row).length === 0) return;

  await withCurrentUser(async (trx) => {
    await trx
      .updateTable("goals")
      .set(row as never)
      .where("id", "=", id)
      .execute();
  });
}

export async function deleteGoalAction(id: string): Promise<void> {
  await exigirGestao();

  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("goals").where("id", "=", id).execute();
  });
}
