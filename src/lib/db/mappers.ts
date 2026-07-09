import type {
  Order,
  OrderItem,
  Product,
  User,
  Campaign,
  Goal,
  AppNotification,
} from "@/types/domain";

/**
 * Row ↔ domain mappers.
 *
 * App online-only: o Supabase é a única fonte de verdade. Estas funções são o
 * ÚNICO ponto que traduz entre o formato do banco (snake_case) e o modelo de
 * domínio (camelCase). Repositórios e hooks reutilizam tudo daqui, então o
 * mapeamento vive num lugar só.
 */

export const PRODUCT_COLUMNS =
  "id, sku, barcode, name, description, category, cost_cents, price_cents, unit, stock, low_stock_threshold, color, size, grade, image_url, active, created_at, updated_at";

export const ORDER_COLUMNS =
  "id, reference, customer_id, customer_name, subtotal_cents, discount_cents, total_cents, payment_method, tendered_cents, change_cents, status, seller_id, seller_name, campaign_id, created_by, created_at";

export const ORDER_ITEM_COLUMNS =
  "id, order_id, product_id, sku, name, image_url, unit_price_cents, quantity, line_discount_cents, color, size";

export const PROFILE_COLUMNS =
  "id, username, full_name, birth_date, role, photo_url, active, created_at";

export const CAMPAIGN_COLUMNS = "id, name, active, created_at";

export const GOAL_COLUMNS =
  "id, seller_id, type, campaign_id, target_cents, target_quantity, created_at";

export const NOTIFICATION_COLUMNS =
  "id, kind, title, body, read, created_at";

type Row = Record<string, unknown>;

export function toProduct(r: Row): Product {
  return {
    id: r.id as string,
    sku: r.sku as string,
    barcode: (r.barcode as string | null) ?? null,
    name: r.name as string,
    description: (r.description as string | null) ?? null,
    category: (r.category as Product["category"]) ?? "outros",
    costCents: (r.cost_cents as number) ?? 0,
    priceCents: (r.price_cents as number) ?? 0,
    unit: (r.unit as string) ?? "un",
    stock: (r.stock as number) ?? 0,
    lowStockThreshold: (r.low_stock_threshold as number) ?? 0,
    color: (r.color as string | null) ?? null,
    size: (r.size as string | null) ?? null,
    grade: Array.isArray(r.grade) ? (r.grade as Product["grade"]) : [],
    imageUrl: (r.image_url as string | null) ?? null,
    active: (r.active as boolean) ?? true,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function productToRow(p: Product): Row {
  return {
    id: p.id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    category: p.category,
    cost_cents: p.costCents,
    price_cents: p.priceCents,
    unit: p.unit,
    stock: p.stock,
    low_stock_threshold: p.lowStockThreshold,
    color: p.color,
    size: p.size,
    grade: p.grade ?? [],
    image_url: p.imageUrl,
    active: p.active,
    updated_at: p.updatedAt,
  };
}

export function toOrderItem(r: Row): OrderItem {
  return {
    id: r.id as string,
    orderId: r.order_id as string,
    productId: (r.product_id as string) ?? "",
    sku: r.sku as string,
    name: r.name as string,
    imageUrl: (r.image_url as string | null) ?? null,
    unitPriceCents: r.unit_price_cents as number,
    quantity: r.quantity as number,
    lineDiscountCents: (r.line_discount_cents as number) ?? 0,
    color: (r.color as string | null) ?? null,
    size: (r.size as string | null) ?? null,
  };
}

export function toOrder(r: Row, items: OrderItem[]): Order {
  return {
    id: r.id as string,
    reference: r.reference as string,
    customerId: (r.customer_id as string | null) ?? null,
    customerName: (r.customer_name as string | null) ?? null,
    items,
    subtotalCents: r.subtotal_cents as number,
    discountCents: r.discount_cents as number,
    totalCents: r.total_cents as number,
    paymentMethod: r.payment_method as Order["paymentMethod"],
    tenderedCents: (r.tendered_cents as number | null) ?? null,
    changeCents: (r.change_cents as number | null) ?? null,
    status: r.status as Order["status"],
    sellerId: (r.seller_id as string | null) ?? null,
    sellerName: (r.seller_name as string | null) ?? null,
    campaignId: (r.campaign_id as string | null) ?? null,
    createdAt: r.created_at as string,
    createdBy: (r.created_by as string | null) ?? null,
  };
}

export function toUser(r: Row): User {
  return {
    id: r.id as string,
    username: (r.username as string) ?? "",
    fullName: (r.full_name as string) ?? "",
    birthDate: (r.birth_date as string | null) ?? null,
    role: r.role as User["role"],
    photoUrl: (r.photo_url as string | null) ?? null,
    active: (r.active as boolean) ?? true,
    createdAt: r.created_at as string,
  };
}

export function toCampaign(r: Row): Campaign {
  return {
    id: r.id as string,
    name: r.name as string,
    active: r.active as boolean,
    createdAt: r.created_at as string,
  };
}

export function toGoal(r: Row): Goal {
  return {
    id: r.id as string,
    sellerId: r.seller_id as string,
    type: r.type as Goal["type"],
    campaignId: (r.campaign_id as string | null) ?? null,
    targetCents: (r.target_cents as number | null) ?? null,
    targetQuantity: (r.target_quantity as number | null) ?? null,
    createdAt: r.created_at as string,
  };
}

export function toNotification(r: Row): AppNotification {
  return {
    id: r.id as string,
    kind: r.kind as AppNotification["kind"],
    title: r.title as string,
    body: (r.body as string) ?? "",
    read: (r.read as boolean) ?? false,
    createdAt: r.created_at as string,
  };
}
