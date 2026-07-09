import { createClient } from "@/lib/supabase/client";
import { ORDER_COLUMNS, ORDER_ITEM_COLUMNS, toOrder, toOrderItem } from "@/lib/db/mappers";
import type {
  Order,
  OrderItem,
  CartItem,
  PaymentMethod,
} from "@/types/domain";
import { computeTotals, changeCents } from "@/lib/utils/cart";

/**
 * Order repository — online-only.
 *
 * Registrar uma venda é uma sequência de escritas no Supabase:
 *   1. next_order_reference() → número sequencial autoritativo do servidor.
 *   2. insert do cabeçalho em `orders`.
 *   3. insert das linhas em `order_items`.
 *   4. insert dos movimentos em `stock_movements` (o gatilho SQL dá baixa no
 *      estoque — o cliente nunca calcula estoque).
 *
 * A numeração e o estoque são 100% do servidor, eliminando divergência entre
 * dispositivos.
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
  createdBy?: string | null;
}

export async function recordSale(input: RecordSaleInput): Promise<Order> {
  const supabase = createClient();
  const totals = computeTotals(input.items, input.globalDiscountCents);
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // 1) Referência sequencial autoritativa do servidor (#PDD-XXX).
  const { data: reference, error: refErr } = await supabase.rpc(
    "next_order_reference",
  );
  if (refErr) throw refErr;

  const items: OrderItem[] = input.items.map((i) => ({
    ...i,
    id: crypto.randomUUID(),
    orderId,
  }));

  const order: Order = {
    id: orderId,
    reference: (reference as string) ?? "",
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
    createdAt: now,
    createdBy: input.createdBy ?? null,
  };

  // 2) Cabeçalho do pedido.
  const { error: orderErr } = await supabase.from("orders").insert({
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
    created_by: order.createdBy,
    created_at: order.createdAt,
  });
  if (orderErr) throw orderErr;

  // 3) Linhas do pedido.
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from("order_items").insert(
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
      })),
    );
    if (itemsErr) throw itemsErr;
  }

  // 4) Movimentos de estoque (gatilho SQL dá baixa em products.stock).
  if (input.items.length > 0) {
    const { error: moveErr } = await supabase.from("stock_movements").insert(
      input.items.map((i) => ({
        product_id: i.productId,
        delta: -i.quantity,
        reason: "sale",
        order_id: orderId,
        // color+size fazem o gatilho baixar a célula certa da grade (Rosa/38).
        color: i.color,
        size: i.size,
      })),
    );
    if (moveErr) throw moveErr;
  }

  return order;
}

export async function listOrders(): Promise<Order[]> {
  const supabase = createClient();

  const { data: headers, error: headErr } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false });
  if (headErr) throw headErr;

  const rows = headers ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((o) => o.id as string);
  const { data: itemRows, error: itemsErr } = await supabase
    .from("order_items")
    .select(ORDER_ITEM_COLUMNS)
    .in("order_id", ids);
  if (itemsErr) throw itemsErr;

  const byOrder = new Map<string, OrderItem[]>();
  for (const r of itemRows ?? []) {
    const it = toOrderItem(r);
    const list = byOrder.get(it.orderId) ?? [];
    list.push(it);
    byOrder.set(it.orderId, list);
  }

  return rows.map((r) => toOrder(r, byOrder.get(r.id as string) ?? []));
}

/**
 * Estorna uma venda concluída: repõe o estoque (movimentos "return", aplicados
 * pelo gatilho) e marca o pedido como "refunded".
 */
export async function refundOrder(orderId: string): Promise<void> {
  const supabase = createClient();

  const { data: header, error: headErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (headErr) throw headErr;
  if (!header || header.status === "refunded") return;

  const { data: itemRows, error: itemsErr } = await supabase
    .from("order_items")
    .select("product_id, quantity, color, size")
    .eq("order_id", orderId);
  if (itemsErr) throw itemsErr;

  const moves = (itemRows ?? [])
    .filter((i) => i.product_id)
    .map((i) => ({
      product_id: i.product_id as string,
      delta: i.quantity as number, // positivo: repõe estoque
      reason: "return" as const,
      order_id: orderId,
      note: "Estorno",
      // Repõe na mesma variação que saiu.
      color: (i.color as string | null) ?? null,
      size: (i.size as string | null) ?? null,
    }));

  if (moves.length > 0) {
    const { error: moveErr } = await supabase
      .from("stock_movements")
      .insert(moves);
    if (moveErr) throw moveErr;
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);
  if (updErr) throw updErr;
}
