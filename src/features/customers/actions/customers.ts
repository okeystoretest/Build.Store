"use server";

import { randomUUID } from "crypto";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toCustomer } from "@/lib/db/mappers";
import { phoneDigits } from "@/lib/utils/phone";
import type { Customer } from "@/types/domain";

/**
 * Server Actions de Clientes — Kysely + RLS por sessão. Código de cliente é
 * numérico e por loja; a busca de autocomplete casa por nome OU código.
 */

export async function listCustomersAction(
  storeId?: string | null,
): Promise<Customer[]> {
  return withCurrentUser(async (trx) => {
    let q = trx.selectFrom("customers").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.orderBy("name", "asc").execute();
    return rows.map((r) => toCustomer(r as Record<string, unknown>));
  });
}

export async function searchCustomersAction(
  term: string,
  limit = 8,
  storeId?: string | null,
): Promise<Customer[]> {
  const q = term.trim();
  return withCurrentUser(async (trx) => {
    let query = trx.selectFrom("customers").selectAll();
    if (storeId) query = query.where("store_id", "=", storeId);
    if (q.length > 0) {
      const like = `%${q}%`;
      query = query.where((eb) =>
        eb.or([eb("name", "ilike", like), eb("code", "ilike", like)]),
      );
    }
    const rows = await query.orderBy("name", "asc").limit(limit).execute();
    return rows.map((r) => toCustomer(r as Record<string, unknown>));
  });
}

export async function nextCustomerCodeAction(
  storeId?: string | null,
): Promise<string> {
  return withCurrentUser(async (trx) => {
    let q = trx
      .selectFrom("customers")
      .select("code")
      .where("code", "is not", null);
    if (storeId) q = q.where("store_id", "=", storeId);
    const rows = await q.execute();
    let max = 0;
    for (const row of rows) {
      const n = parseInt(String(row.code).replace(/\D/g, ""), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return String(max + 1).padStart(4, "0");
  });
}

export interface CustomerInput {
  code: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  email: string | null;
  storeId: string;
}

export async function createCustomerAction(
  input: CustomerInput,
): Promise<Customer> {
  return withCurrentUser(async (trx) => {
    const insertOne = async (code: string) =>
      trx
        .insertInto("customers")
        .values({
          id: randomUUID(),
          code,
          name: input.name,
          phone: input.phone ? phoneDigits(input.phone) : null,
          instagram: input.instagram,
          email: input.email,
          store_id: input.storeId,
          created_at: new Date().toISOString(),
        } as never)
        .returningAll()
        .executeTakeFirstOrThrow();

    try {
      const row = await insertOne(input.code);
      return toCustomer(row as Record<string, unknown>);
    } catch (e) {
      // 23505 = unique_violation → regenera o código (por loja) e tenta de novo.
      if ((e as { code?: string }).code === "23505") {
        // Próximo código livre desta loja.
        const codes = await trx
          .selectFrom("customers")
          .select("code")
          .where("store_id", "=", input.storeId)
          .where("code", "is not", null)
          .execute();
        let max = 0;
        for (const r of codes) {
          const n = parseInt(String(r.code).replace(/\D/g, ""), 10);
          if (!Number.isNaN(n) && n > max) max = n;
        }
        const fresh = String(max + 1).padStart(4, "0");
        const row = await insertOne(fresh);
        return toCustomer(row as Record<string, unknown>);
      }
      throw e;
    }
  });
}

export async function updateCustomerAction(
  id: string,
  patch: Partial<
    Pick<Customer, "code" | "name" | "phone" | "instagram" | "email">
  >,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.code !== undefined) row.code = patch.code;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined)
    row.phone = patch.phone ? phoneDigits(patch.phone) : null;
  if (patch.instagram !== undefined) row.instagram = patch.instagram;
  if (patch.email !== undefined) row.email = patch.email;
  if (Object.keys(row).length === 0) return;

  await withCurrentUser(async (trx) => {
    await trx
      .updateTable("customers")
      .set(row as never)
      .where("id", "=", id)
      .execute();
  });
}

export async function deleteCustomerAction(id: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    await trx.deleteFrom("customers").where("id", "=", id).execute();
  });
}
