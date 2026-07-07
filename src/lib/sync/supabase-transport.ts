import { createClient } from "@/lib/supabase/client";
import type { SyncTransport } from "@/lib/sync/transport";
import type { Order, Product } from "@/types/domain";

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

    // Upsert the order header (idempotent on the client-generated id).
    const { error: orderErr } = await this.supabase.from("orders").upsert({
      id: order.id,
      store_id: storeId,
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

    // Record stock movements only for a fresh completed sale; the DB trigger
    // decrements product stock. Refunds push positive movements instead.
    const delta = order.status === "refunded" ? 1 : -1;
    const reason = order.status === "refunded" ? "return" : "sale";
    const { error: moveErr } = await this.supabase.from("stock_movements").insert(
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
      image_url: product.imageUrl,
      active: product.active,
      updated_at: product.updatedAt,
    });
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
        imageUrl: r.image_url,
        active: r.active,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }),
    );
  }
}
