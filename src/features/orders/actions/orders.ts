"use server";

import { randomUUID } from "crypto";
import { sql } from "kysely";
import { withCurrentUser } from "@/lib/db/with-current-user";
import { toOrder, toOrderItem } from "@/lib/db/mappers";
import type { Order, OrderItem, CartItem, PaymentMethod } from "@/types/domain";
import { computeTotals, changeCents } from "@/lib/utils/cart";

/**
 * Server Actions de Pedidos — Kysely + RLS por sessão.
 *
 * Registrar venda é transacional (withCurrentUser abre uma transação):
 *   1. next_order_reference(store) → nº sequencial autoritativo POR LOJA.
 *   2. insert do cabeçalho (orders).
 *   3. insert das linhas (order_items).
 *   4. insert dos movimentos (stock_movements) — o gatilho SQL dá baixa no
 *      estoque. Tudo numa transação: se algo falhar, nada é gravado.
 */

export interface RecordSaleInput {
  items: CartItem[];
  globalDiscountCents: number;
  paymentMethod: PaymentMethod;
  tenderedCents: number | null;
  customerId?: string | null;
  customerName?: string | null;
  sellerId?: string | null;
  sellerName?: string | null;
  campaignId?: string | null;
  invoiceNumber?: string | null;
  createdBy?: string | null;
  storeId: string;
}

export async function recordSaleAction(input: RecordSaleInput): Promise<Order> {
  const totals = computeTotals(input.items, input.globalDiscountCents);
  const orderId = randomUUID();
  const now = new Date().toISOString();

  return withCurrentUser(async (trx) => {
    // 1) Referência sequencial por loja (função da 0004).
    const refRow = await sql<{ next_order_reference: string }>`
      select public.next_order_reference(${input.storeId}) as next_order_reference
    `.execute(trx);
    const reference = refRow.rows[0]?.next_order_reference ?? "";

    const items: OrderItem[] = input.items.map((i) => ({
      ...i,
      id: randomUUID(),
      orderId,
    }));

    const order: Order = {
      id: orderId,
      reference,
      customerId: input.customerId ?? null,
      customerName: input.customerName ?? null,
      items,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      paymentMethod: input.paymentMethod,
      tenderedCents: input.tenderedCents,
      changeCents:
        input.paymentMethod === "cash" && input.tenderedCents != null
          ? changeCents(totals.totalCents, input.tenderedCents)
          : null,
      status: "completed",
      sellerId: input.sellerId ?? null,
      sellerName: input.sellerName ?? null,
      campaignId: input.campaignId ?? null,
      invoiceNumber: input.invoiceNumber?.trim()
        ? input.invoiceNumber.trim()
        : null,
      createdAt: now,
      createdBy: input.createdBy ?? null,
    };

    // 2) Cabeçalho.
    await trx
      .insertInto("orders")
      .values({
        id: order.id,
        reference: order.reference,
        customer_id: order.customerId,
        customer_name: order.customerName,
        subtotal_cents: order.subtotalCents,
        discount_cents: order.discountCents,
        total_cents: order.totalCents,
        payment_method: order.paymentMethod,
        tendered_cents: order.tenderedCents,
        change_cents: order.changeCents,
        status: order.status,
        seller_id: order.sellerId,
        seller_name: order.sellerName,
        campaign_id: order.campaignId,
        invoice_number: order.invoiceNumber,
        created_by: order.createdBy,
        created_at: order.createdAt,
        store_id: input.storeId,
      } as never)
      .execute();

    // 3) Linhas.
    if (items.length > 0) {
      await trx
        .insertInto("order_items")
        .values(
          items.map((i) => ({
            id: i.id,
            order_id: orderId,
            product_id: i.productId,
            sku: i.sku,
            name: i.name,
            image_url: i.imageUrl,
            unit_price_cents: i.unitPriceCents,
            quantity: i.quantity,
            line_discount_cents: i.lineDiscountCents,
            color: i.color,
            size: i.size,
            store_id: input.storeId,
          })) as never,
        )
        .execute();
    }

    // 4) Movimentos de estoque (gatilho dá baixa).
    if (input.items.length > 0) {
      await trx
        .insertInto("stock_movements")
        .values(
          input.items.map((i) => ({
            product_id: i.productId,
            delta: -i.quantity,
            reason: "sale",
            order_id: orderId,
            color: i.color,
            size: i.size,
            store_id: input.storeId,
          })) as never,
        )
        .execute();
    }

    return order;
  });
}

export async function listOrdersAction(
  storeId?: string | null,
): Promise<Order[]> {
  return withCurrentUser(async (trx) => {
    // Sem storeId, quem decide o alcance é a RLS: a própria loja para
    // vendedora/lojista, todas para o admin — que é exatamente o consolidado de
    // "Todas as lojas". Com storeId, o admin restringe o painel a uma unidade,
    // no mesmo padrão já usado em produtos, clientes e gestão.
    let q = trx.selectFrom("orders").selectAll();
    if (storeId) q = q.where("store_id", "=", storeId);
    const headers = await q.orderBy("created_at", "desc").execute();
    if (headers.length === 0) return [];

    const ids = headers.map((o) => o.id as string);
    const itemRows = await trx
      .selectFrom("order_items")
      .selectAll()
      .where("order_id", "in", ids)
      .execute();

    const byOrder = new Map<string, OrderItem[]>();
    for (const r of itemRows) {
      const it = toOrderItem(r as Record<string, unknown>);
      const list = byOrder.get(it.orderId) ?? [];
      list.push(it);
      byOrder.set(it.orderId, list);
    }
    return headers.map((r) =>
      toOrder(r as Record<string, unknown>, byOrder.get(r.id as string) ?? []),
    );
  });
}

/** Estorno: repõe estoque (movimentos "return") e marca o pedido "refunded". */
export async function refundOrderAction(orderId: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    const header = await trx
      .selectFrom("orders")
      .select(["id", "status", "store_id"])
      .where("id", "=", orderId)
      .executeTakeFirst();
    if (!header || (header.status as string) === "refunded") return;

    const itemRows = await trx
      .selectFrom("order_items")
      .select(["product_id", "quantity", "color", "size"])
      .where("order_id", "=", orderId)
      .execute();

    const moves = itemRows
      .filter((i) => i.product_id)
      .map((i) => ({
        product_id: i.product_id as string,
        delta: i.quantity as number,
        reason: "return",
        order_id: orderId,
        note: "Estorno",
        color: (i.color as string | null) ?? null,
        size: (i.size as string | null) ?? null,
        store_id: header.store_id as string,
      }));

    if (moves.length > 0) {
      await trx.insertInto("stock_movements").values(moves as never).execute();
    }
    await trx
      .updateTable("orders")
      .set({ status: "refunded" })
      .where("id", "=", orderId)
      .execute();
  });
}

/** Estorno apagando o pedido: repõe estoque e remove a venda (cascade). */
export async function deleteOrderAction(orderId: string): Promise<void> {
  await withCurrentUser(async (trx) => {
    const header = await trx
      .selectFrom("orders")
      .select(["id", "status", "store_id"])
      .where("id", "=", orderId)
      .executeTakeFirst();
    if (!header) return;

    if ((header.status as string) !== "refunded") {
      const itemRows = await trx
        .selectFrom("order_items")
        .select(["product_id", "quantity", "color", "size"])
        .where("order_id", "=", orderId)
        .execute();

      const moves = itemRows
        .filter((i) => i.product_id)
        .map((i) => ({
          product_id: i.product_id as string,
          delta: i.quantity as number,
          reason: "return",
          note: "Estorno (pedido apagado)",
          color: (i.color as string | null) ?? null,
          size: (i.size as string | null) ?? null,
          store_id: header.store_id as string,
        }));

      if (moves.length > 0) {
        await trx.insertInto("stock_movements").values(moves as never).execute();
      }
    }

    await trx.deleteFrom("orders").where("id", "=", orderId).execute();
  });
}
