/**
 * Tipagem do banco para o Kysely (camada de dados da VPS, sem Supabase).
 *
 * Reflete o schema real (conferido via information_schema) + as colunas
 * multi-tenant da 0004 (store_id) e as peças de auth própria da Fase 2
 * (sessions, profiles.password_hash).
 *
 * Convenção: snake_case aqui (nomes reais de coluna). A conversão para o domínio
 * camelCase continua nos mappers existentes.
 */

export interface Database {
  stores: StoresTable;
  profiles: ProfilesTable;
  sessions: SessionsTable;
  products: ProductsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  customers: CustomersTable;
  goals: GoalsTable;
  campaigns: CampaignsTable;
  stock_movements: StockMovementsTable;
  notifications: NotificationsTable;
  showcase_media: ShowcaseMediaTable;
  settings: SettingsTable;
  counters: CountersTable;
}

export interface StoresTable {
  id: string;
  name: string;
  logo_url: string | null;
  active: boolean;
  created_at: string;
}

export interface ProfilesTable {
  id: string;
  username: string;
  full_name: string | null;
  birth_date: string | null;
  role: "vendedora" | "lojista" | "admin";
  photo_url: string | null;
  active: boolean;
  store_id: string | null;
  /** Auth própria: hash Argon2 da senha (substitui o Supabase Auth). */
  password_hash: string | null;
  created_at: string;
}

/** Sessões do Lucia. */
export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: Date;
}

export interface ProductsTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface OrdersTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface OrderItemsTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface CustomersTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface GoalsTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface CampaignsTable {
  id: string;
  store_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
}

export interface StockMovementsTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface NotificationsTable {
  id: string;
  store_id: string | null;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface ShowcaseMediaTable {
  id: string;
  store_id: string | null;
  [key: string]: unknown;
}

export interface SettingsTable {
  key: string;
  store_id: string;
  value: string | null;
  updated_at: string;
}

export interface CountersTable {
  id: string;
  store_id: string;
  value: number;
}
