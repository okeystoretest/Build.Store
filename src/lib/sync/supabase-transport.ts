import { createClient } from "@/lib/supabase/client";
import type { SyncTransport } from "@/lib/sync/transport";
import type { Order, Product, User, Campaign, Goal } from "@/types/domain";

/**
 * Supabase implementation of SyncTransport. Plugs into the exact interface the
 * Fase 3 sync engine already calls — no feature or repository changes needed to
 * go from local-only (NullTransport) to backed-by-Supabase. Flip the binding in
 * lib/sync/transport.ts to activate.
 *
 * Wire format maps the camelCase domain model to the snake_case SQL schema
 * (see supabase/schema.sql). The stock trigger on the server keeps product
 * stock authoritative, so we push stock_movements rather than raw stock.
 */
export class SupabaseTransport implements SyncTransport {
  private supabase = createClient();

  /** Resolve the caller's store id from their profile (RLS-safe). */
  private async storeId(): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão para sincronizar");
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();
    if (error || !profile) throw error ?? new Error("Perfil ausente");
    return profile.store_id as string;
  }

  async pushOrder(order: Order): Promise<void> {
    // Resolve the caller's store from their profile (RLS also enforces it).
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão para sincronizar");

    const { data: profile, error: profileErr } = await this.supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();
    if (profileErr || !profile) throw profileErr ?? new Error("Perfil ausente");

    const storeId = profile.store_id as string;

    // Numeração autoritativa do servidor. Cada loja tem seu contador; a função
    // next_order_reference() incrementa atomicamente e devolve "#PDD-XXX". Isso
    // evita colisão de referência entre dispositivos (a referência local gerada
    // offline é apenas provisória). Só geramos uma nova quando o pedido ainda
    // não tem uma referência confirmada pelo servidor — assim reenvios (retry)
    // do mesmo pedido não consomem números novos.
    let reference = order.reference;
    const alreadyServerNumbered = await this.supabase
      .from("orders")
      .select("reference")
      .eq("id", order.id)
      .maybeSingle();

    if (alreadyServerNumbered.data?.reference) {
      // Reenvio de um pedido já numerado: reaproveita a referência do servidor.
      reference = alreadyServerNumbered.data.reference;
    } else {
      const { data: newRef, error: refErr } = await this.supabase.rpc(
        "next_order_reference",
        { p_store_id: storeId },
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

    // Upsert the order header (idempotent on the client-generated id).
    const { error: orderErr } = await this.supabase.from("orders").upsert({
      id: order.id,
      store_id: storeId,
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

    // Replace line items for this order (safe on retry).
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
    // inserção, então precisam ser idempotentes. Uma venda gera movimentos de
    // "sale"; um estorno gera movimentos de "return". Só inserimos se ainda não
    // houver movimentos daquele tipo para este pedido — assim reenvios (retry
    // de sincronização ou re-push de estorno) não decrementam/incrementam o
    // estoque em duplicidade.
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
            store_id: storeId,
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

    const { data: profile } = await this.supabase
      .from("profiles")
      .select("store_id")
      .eq("id", user.id)
      .single();
    if (!profile) throw new Error("Perfil ausente");

    const { error } = await this.supabase.from("products").upsert({
      id: product.id,
      store_id: profile.store_id,
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
    const storeId = await this.storeId();
    const { error } = await this.supabase.from("campaigns").upsert({
      id: campaign.id,
      store_id: storeId,
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
    const storeId = await this.storeId();
    const { error } = await this.supabase.from("goals").upsert({
      id: goal.id,
      store_id: storeId,
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
    // Cabeçalhos + itens numa consulta aninhada. RLS já limita à loja do
    // usuário, então não é preciso filtrar por store_id aqui.
    const { data, error } = await this.supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;

    return (data ?? []).map((r): Order => {
      const items: Order["items"] = (r.order_items ?? []).map(
        (it: Record<string, unknown>) => ({
          id: it.id as string,
          orderId: r.id as string,
          productId: (it.product_id as string) ?? "",
          sku: it.sku as string,
          name: it.name as string,
          imageUrl: (it.image_url as string | null) ?? null,
          unitPriceCents: it.unit_price_cents as number,
          quantity: it.quantity as number,
          lineDiscountCents: (it.line_discount_cents as number) ?? 0,
        }),
      );

      return {
        id: r.id,
        reference: r.reference,
        customerId: r.customer_id ?? null,
        customerName: r.customer_name ?? null,
        items,
        subtotalCents: r.subtotal_cents,
        discountCents: r.discount_cents,
        totalCents: r.total_cents,
        paymentMethod: r.payment_method,
        tenderedCents: r.tendered_cents ?? null,
        changeCents: r.change_cents ?? null,
        status: r.status,
        // Vindo do servidor, já está sincronizado.
        syncStatus: "synced",
        sellerId: r.seller_id ?? null,
        sellerName: r.seller_name ?? null,
        campaignId: r.campaign_id ?? null,
        createdAt: r.created_at,
        createdBy: r.created_by ?? null,
      };
    });
  }

  async pullUsers(): Promise<User[]> {
    // Os usuários do app são os profiles da loja (RLS: mesma loja).
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
