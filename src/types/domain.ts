/**
 * Build.Store — Domain model.
 * Single source of truth for entities shared across features.
 * These types mirror the Supabase schema (see supabase/schema.sql). The app is
 * online-only: every read and write goes straight to Supabase.
 */

export type UUID = string;
export type ISODateString = string;

/** Payment modalities supported at checkout. */
export type PaymentMethod = "cash" | "credit" | "debit" | "pix" | "wallet";

/** Lifecycle of a persisted order. */
export type OrderStatus = "completed" | "refunded" | "cancelled" | "pending";

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

/**
 * Item da grade de peças: uma variação cor/tamanho com sua quantidade em
 * estoque. A soma de todas as quantidades da grade é o estoque total do
 * produto (Product.stock).
 */

/** Tamanhos fixos usados na grade de todos os produtos. */
export const GRADE_SIZES = ["36", "38", "40"] as const;
export type GradeSize = (typeof GRADE_SIZES)[number];

/**
 * Uma linha da grade: uma cor com a quantidade em estoque de cada tamanho.
 * Ex.: { color: "Rosa", sizes: { "36": 3, "38": 5, "40": 2 } }.
 */
export interface GradeItem {
  color: string | null;
  /** Quantidade por tamanho (chaves = GRADE_SIZES). */
  sizes: Record<string, number>;
}

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
  /** Grade de peças — cor (legado; primeira cor da grade). */
  color: string | null;
  /** Grade de peças — tamanho (legado; primeiro tamanho da grade). */
  size: string | null;
  /** Grade de peças — cores com quantidade por tamanho. */
  grade: GradeItem[];
  /**
   * Endereço físico do produto no estoque (ex.: prateleira/gaveta). Editável
   * apenas por Lojista e Vendedora.
   */
  address: string | null;
  imageUrl: string | null;
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Customer {
  id: UUID;
  /** Código único e legível do cliente (ex.: CLI-0001). Gerado no cadastro. */
  code: string | null;
  name: string;
  /** Contato (telefone), armazenado só com dígitos; formatado na UI. */
  phone: string | null;
  /** Endereço completo (legado; removido do formulário atual). */
  address: string | null;
  /** @ do Instagram do cliente (sem o "@"). */
  instagram: string | null;
  /** E-mail do cliente. */
  email: string | null;
  document: string | null; // CPF (legado; não usado no formulário atual)
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
  /** Variação vendida: cor e tamanho escolhidos no PDV. */
  color: string | null;
  size: string | null;
  /**
   * Estoque disponível da variação (transitório, só no carrinho). Limita a
   * quantidade vendável; NÃO é persistido no pedido.
   */
  maxQuantity?: number;
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
  /** Seller responsible for the sale (chosen at checkout). */
  sellerId: UUID | null;
  sellerName: string | null;
  /** Campaign this sale is attributed to, when flagged at checkout. */
  campaignId: UUID | null;
  /** Número da Nota Fiscal informado no checkout do PDV. */
  invoiceNumber: string | null;
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
  username: string; // login handle; maps to auth email via usernameToEmail()
  fullName: string;
  birthDate: string | null; // YYYY-MM-DD
  role: Role;
  /** Foto de perfil (data URL local; Supabase Storage em produção). */
  photoUrl: string | null;
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
