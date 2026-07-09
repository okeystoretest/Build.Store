import { createClient } from "@/lib/supabase/client";
import type { SyncTransport } from "@/lib/sync/transport";
import type { Order, Product, User, Campaign, Goal } from "@/types/domain";

/**
 * Supabase implementation of SyncTransport.
 *
 * Arquitetura de loja única: NÃO há `store_id`. Os dados são globais — qualquer
 * usuário autenticado lê e escreve a mesma base (o RLS libera tudo para
 * `authenticated`). Removidas todas as resoluções de store via profile e a
 * numeração de pedido passou a usar next_order_reference() sem argumento.
 *
 * O wire format mapeia o modelo de domínio (camelCase) para o schema SQL
 * (snake_case) — ver supabase/schema.sql. O gatilho de estoque no servidor
 * mantém products.stock autoritativo, então empurramos stock_movements em vez
 * de estoque bruto.
 */
export class SupabaseTransport implements SyncTransport {
  private supabase = createClient();

  async pushOrder(order: Order): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão para sincronizar");

    // Numeração autoritativa do servidor. next_order_reference() incrementa um
    // contador global atômico e devolve "#PDD-XXX". Só geramos uma nova quando
    // o pedido ainda não tem referência confirmada pelo servidor — assim
    // reenvios (retry) do mesmo pedido não consomem números novos.
    let reference = order.reference;
    const alreadyServerNumbered = await this.supabase
      .from("orders")
      .select("reference")
      .eq("id", order.id)
      .maybeSingle();

    if (alreadyServerNumbered.data?.reference) {
      reference = alreadyServerNumbered.data.reference;
    } else {
      const { data: newRef, error: refErr } = await this.supabase.rpc(
        "next_order_reference",
      );
      if (refErr) throw refErr;
      if (typeof newRef === "string") reference = newRef;
    }

    // Persiste a referência canônica de volta no espelho local, para que a UI
    // (histórico de pedidos, comprovante) mostre o número definitivo.
    if (reference !== order.reference) {
      const { db } = await import("@/lib/db/dexie");
      await db.orders.update(order.id, { reference });
      order.reference = reference;
    }

    // Upsert do cabeçalho (idempotente no id gerado no cliente).
    const { error: orderErr } = await this.supabase.from("orders").upsert({
      id: order.id,
      reference,
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

    // Substitui os itens deste pedido (seguro em retry).
    await this.supabase.from("order_items").delete().eq("order_id", order.id);
    if (order.items.length > 0) {
      const { error: itemsErr } = await this.supabase.from("order_items").insert(
        order.items.map((i) => ({
          id: i.id,
          order_id: order.id,
          product_id: i.productId,
          sku: i.sku,
          name: i.name,
          image_url: i.imageUrl,
          unit_price_cents: i.unitPriceCents,
          quantity: i.quantity,
          line_discount_cents: i.lineDiscountCents,
        })),
      );
      if (itemsErr) throw itemsErr;
    }

    // Movimentos de estoque: o gatilho do banco ajusta o estoque a cada
    // inserção, então precisam ser idempotentes. Venda gera "sale"; estorno
    // gera "return". Só inserimos se ainda não houver movimentos daquele tipo
    // para este pedido — assim reenvios não duplicam a baixa/reposição.
    const reason = order.status === "refunded" ? "return" : "sale";
    const delta = order.status === "refunded" ? 1 : -1;

    const { count: existingMoves, error: countErr } = await this.supabase
      .from("stock_movements")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id)
      .eq("reason", reason);
    if (countErr) throw countErr;

    if (!existingMoves || existingMoves === 0) {
      const { error: moveErr } = await this.supabase
        .from("stock_movements")
        .insert(
          order.items.map((i) => ({
            product_id: i.productId,
            delta: delta * i.quantity,
            reason,
            order_id: order.id,
          })),
        );
      if (moveErr) throw moveErr;
    }
  }

  async pushProduct(product: Product): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão para sincronizar");

    const { error } = await this.supabase.from("products").upsert({
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      description: product.description,
      category: product.category,
      cost_cents: product.costCents,
      price_cents: product.priceCents,
      unit: product.unit,
      stock: product.stock,
      low_stock_threshold: product.lowStockThreshold,
      color: product.color,
      size: product.size,
      grade: product.grade ?? [],
      image_url: product.imageUrl,
      active: product.active,
      updated_at: product.updatedAt,
    });
    if (error) throw error;
  }

  async deleteProduct(id: string): Promise<void> {
    const { error } = await this.supabase.from("products").delete().eq("id", id);
    if (error) throw error;
  }

  async pushCampaign(campaign: Campaign): Promise<void> {
    const { error } = await this.supabase.from("campaigns").upsert({
      id: campaign.id,
      name: campaign.name,
      active: campaign.active,
      created_at: campaign.createdAt,
    });
    if (error) throw error;
  }

  async deleteCampaign(id: string): Promise<void> {
    const { error } = await this.supabase.from("campaigns").delete().eq("id", id);
    if (error) throw error;
  }

  async pushGoal(goal: Goal): Promise<void> {
    const { error } = await this.supabase.from("goals").upsert({
      id: goal.id,
      seller_id: goal.sellerId,
      type: goal.type,
      campaign_id: goal.campaignId,
      target_cents: goal.targetCents,
      target_quantity: goal.targetQuantity,
      created_at: goal.createdAt,
    });
    if (error) throw error;
  }

  async deleteGoal(id: string): Promise<void> {
    const { error } = await this.supabase.from("goals").delete().eq("id", id);
    if (error) throw error;
  }

  async pushUserUpdate(
    id: string,
    patch: Partial<Pick<User, "fullName" | "birthDate" | "role" | "photoUrl" | "active">>,
  ): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.birthDate !== undefined) row.birth_date = patch.birthDate;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
    if (patch.active !== undefined) row.active = patch.active;
    if (Object.keys(row).length === 0) return;

    const { error } = await this.supabase
      .from("profiles")
      .update(row)
      .eq("id", id);
    if (error) throw error;
  }

  async pullProducts(since: string | null): Promise<Product[]> {
    let query = this.supabase.from("products").select("*");
    if (since) query = query.gt("updated_at", since);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map(
      (r): Product => ({
        id: r.id,
        sku: r.sku,
        barcode: r.barcode,
        name: r.name,
        description: r.description,
        category: r.category,
        costCents: r.cost_cents,
        priceCents: r.price_cents,
        unit: r.unit,
        stock: r.stock,
        lowStockThreshold: r.low_stock_threshold,
        color: r.color ?? null,
        size: r.size ?? null,
        grade: Array.isArray(r.grade) ? r.grade : [],
        imageUrl: r.image_url,
        active: r.active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }),
    );
  }

  async pullOrders(): Promise<Order[]> {
    // Traz os pedidos mais recentes com teto explícito. Duas queries simples
    // (cabeçalhos + itens em lotes) são muito mais baratas que um join aninhado.
    const MAX_ORDERS = 300;

    const { data: headers, error: headErr } = await this.supabase
      .from("orders")
      .select(
        "id, reference, customer_id, customer_name, subtotal_cents, discount_cents, total_cents, payment_method, tendered_cents, change_cents, status, seller_id, seller_name, campaign_id, created_by, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS);
    if (headErr) throw headErr;

    const orderRows = headers ?? [];
    if (orderRows.length === 0) return [];

    const orderIds = orderRows.map((o) => o.id as string);

    const CHUNK = 100;
    const itemRows: Record<string, unknown>[] = [];
    for (let i = 0; i < orderIds.length; i += CHUNK) {
      const slice = orderIds.slice(i, i + CHUNK);
      const { data, error: itemsErr } = await this.supabase
        .from("order_items")
        .select("*")
        .in("order_id", slice);
      if (itemsErr) throw itemsErr;
      if (data) itemRows.push(...data);
    }

    const itemsByOrder = new Map<string, Order["items"]>();
    for (const it of itemRows) {
      const oid = it.order_id as string;
      const list = itemsByOrder.get(oid) ?? [];
      list.push({
        id: it.id as string,
        orderId: oid,
        productId: (it.product_id as string) ?? "",
        sku: it.sku as string,
        name: it.name as string,
        imageUrl: (it.image_url as string | null) ?? null,
        unitPriceCents: it.unit_price_cents as number,
        quantity: it.quantity as number,
        lineDiscountCents: (it.line_discount_cents as number) ?? 0,
      });
      itemsByOrder.set(oid, list);
    }

    return orderRows.map(
      (r): Order => ({
        id: r.id,
        reference: r.reference,
        customerId: r.customer_id ?? null,
        customerName: r.customer_name ?? null,
        items: itemsByOrder.get(r.id as string) ?? [],
        subtotalCents: r.subtotal_cents,
        discountCents: r.discount_cents,
        totalCents: r.total_cents,
        paymentMethod: r.payment_method,
        tenderedCents: r.tendered_cents ?? null,
        changeCents: r.change_cents ?? null,
        status: r.status,
        syncStatus: "synced",
        sellerId: r.seller_id ?? null,
        sellerName: r.seller_name ?? null,
        campaignId: r.campaign_id ?? null,
        createdAt: r.created_at,
        createdBy: r.created_by ?? null,
      }),
    );
  }

  async pullUsers(): Promise<User[]> {
    // Todos os profiles são globais (RLS libera para qualquer autenticado).
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, username, full_name, birth_date, role, photo_url, active, created_at");
    if (error) throw error;

    return (data ?? []).map(
      (r): User => ({
        id: r.id,
        username: r.username ?? "",
        fullName: r.full_name ?? "",
        birthDate: r.birth_date ?? null,
        role: r.role,
        photoUrl: r.photo_url ?? null,
        active: r.active ?? true,
        createdAt: r.created_at,
      }),
    );
  }

  async pullCampaigns(): Promise<Campaign[]> {
    const { data, error } = await this.supabase
      .from("campaigns")
      .select("id, name, active, created_at");
    if (error) throw error;

    return (data ?? []).map(
      (r): Campaign => ({
        id: r.id,
        name: r.name,
        active: r.active,
        createdAt: r.created_at,
      }),
    );
  }

  async pullGoals(): Promise<Goal[]> {
    const { data, error } = await this.supabase
      .from("goals")
      .select("id, seller_id, type, campaign_id, target_cents, target_quantity, created_at");
    if (error) throw error;

    return (data ?? []).map(
      (r): Goal => ({
        id: r.id,
        sellerId: r.seller_id,
        type: r.type,
        campaignId: r.campaign_id ?? null,
        targetCents: r.target_cents ?? null,
        targetQuantity: r.target_quantity ?? null,
        createdAt: r.created_at,
      }),
    );
  }
}
