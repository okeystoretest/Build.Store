/**
 * Build.Store — Domain model.
 * Single source of truth for entities shared across features.
 * These types mirror the Supabase schema (see supabase/schema.sql) and are
 * reused by the local Dexie mirror so offline and online stay structurally
 * identical.
 */

export type UUID = string;
export type ISODateString = string;

/** Payment modalities supported at checkout. */
export type PaymentMethod = "cash" | "credit" | "debit" | "pix" | "wallet";

/** Lifecycle of a persisted order. */
export type OrderStatus = "completed" | "refunded" | "cancelled" | "pending";

/** Sync state for records that originate offline. */
export type SyncStatus = "synced" | "pending" | "error";

/**
 * Access roles (pt-BR domain terms).
 * - vendedora: no access to Relatórios or Gestão.
 * - lojista: all tabs except adding products to stock.
 * - admin: full access, including stock additions.
 */
export type Role = "vendedora" | "lojista" | "admin";

/**
 * Category is retained on the type for backward-compatible data but is no
 * longer surfaced in the UI (filter, form and card dropped per spec). New
 * products default to "outros".
 */
export type ProductCategory =
  | "cosmeticos"
  | "acessorios"
  | "aromaterapia"
  | "outros";

export interface Product {
  id: UUID;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: ProductCategory;
  /** Cost price in minor units (centavos) to avoid float drift. */
  costCents: number;
  /** Sale price in minor units (centavos). */
  priceCents: number;
  unit: string; // e.g. "un", "kg"
  stock: number;
  /** Reorder threshold; stock at/below this raises a low-stock alert. */
  lowStockThreshold: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Customer {
  id: UUID;
  name: string;
  phone: string | null;
  document: string | null; // CPF
  createdAt: ISODateString;
}

/** A line inside the active cart or a persisted order. */
export interface CartItem {
  productId: UUID;
  sku: string;
  name: string;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  /** Per-line discount in centavos, applied before totals. */
  lineDiscountCents: number;
}

export interface OrderItem extends CartItem {
  id: UUID;
  orderId: UUID;
}

export interface Order {
  id: UUID;
  /** Human-facing reference e.g. "#SRN-8842". */
  reference: string;
  customerId: UUID | null;
  customerName: string | null;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  /** Cash tendered, when paymentMethod === "cash". */
  tenderedCents: number | null;
  changeCents: number | null;
  status: OrderStatus;
  syncStatus: SyncStatus;
  /** Seller responsible for the sale (chosen at checkout). */
  sellerId: UUID | null;
  sellerName: string | null;
  /** Campaign this sale is attributed to, when flagged at checkout. */
  campaignId: UUID | null;
  createdAt: ISODateString;
  createdBy: UUID | null;
}

/** Stock movement audit trail (sale, restock, manual adjustment). */
export type StockMovementReason =
  | "sale"
  | "restock"
  | "adjustment"
  | "loss"
  | "return";

export interface StockMovement {
  id: UUID;
  productId: UUID;
  delta: number; // negative for outflow
  reason: StockMovementReason;
  orderId: UUID | null;
  note: string | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Fase A additions: users/sellers, campaigns, goals, notifications
// ---------------------------------------------------------------------------

/**
 * App user. A user with role "vendedora" is also a seller selectable at
 * checkout. birthDate is stored as YYYY-MM-DD. Passwords are never stored here
 * in plain text in production — Supabase Auth owns credentials; in local mode a
 * hash placeholder is kept only to allow offline login demos.
 */
export interface User {
  id: UUID;
  fullName: string;
  birthDate: string | null; // YYYY-MM-DD
  role: Role;
  active: boolean;
  createdAt: ISODateString;
}

/** A sales campaign that goals can be attached to. */
export interface Campaign {
  id: UUID;
  name: string;
  active: boolean;
  createdAt: ISODateString;
}

export type GoalType = "general" | "campaign";

/**
 * A seller goal. "general" goals are monetary (targetCents); "campaign" goals
 * are counted in items (targetQuantity) and reference a campaign. A seller may
 * hold multiple goals simultaneously (one general + several campaign goals).
 */
export interface Goal {
  id: UUID;
  sellerId: UUID;
  type: GoalType;
  campaignId: UUID | null;
  /** For type="general": target revenue in centavos. */
  targetCents: number | null;
  /** For type="campaign": target number of items. */
  targetQuantity: number | null;
  createdAt: ISODateString;
}

export type NotificationKind = "product_added" | "info";

/** In-app notification surfaced in the bell menu. */
export interface AppNotification {
  id: UUID;
  kind: NotificationKind;
  title: string;
  body: string;
  read: boolean;
  createdAt: ISODateString;
}
