import Dexie, { type Table } from "dexie";
import type {
  Order,
  Product,
  Customer,
  StockMovement,
  User,
  Campaign,
  Goal,
  AppNotification,
} from "@/types/domain";

/**
 * Local IndexedDB mirror (Dexie).
 * Products/customers are cached for offline lookup; orders and stock movements
 * created offline live here with syncStatus="pending" until the sync engine
 * flushes them to Supabase. Fase A adds users, campaigns, goals and
 * notifications so seller/campaign/goal features work fully offline. Structure
 * mirrors the domain model so a record can move between local and remote
 * without transformation.
 */
export class BuildStoreDB extends Dexie {
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  orders!: Table<Order, string>;
  stockMovements!: Table<StockMovement, string>;
  users!: Table<User, string>;
  campaigns!: Table<Campaign, string>;
  goals!: Table<Goal, string>;
  notifications!: Table<AppNotification, string>;

  constructor() {
    super("build-store");
    // v1 — original schema.
    this.version(1).stores({
      products: "id, sku, barcode, category, name, stock",
      customers: "id, name, phone, document",
      orders: "id, reference, status, syncStatus, createdAt",
      stockMovements: "id, productId, reason, createdAt",
    });
    // v2 — Fase A: seller/campaign on orders + new tables.
    this.version(2).stores({
      products: "id, sku, barcode, name, stock",
      customers: "id, name, phone, document",
      orders: "id, reference, status, syncStatus, sellerId, campaignId, createdAt",
      stockMovements: "id, productId, reason, createdAt",
      users: "id, role, fullName, active",
      campaigns: "id, name, active",
      goals: "id, sellerId, type, campaignId",
      notifications: "id, read, createdAt",
    });
    // v3 — Fase B: username as a unique login handle on users.
    this.version(3).stores({
      users: "id, &username, role, fullName, active",
    });
  }
}

/** Singleton — one connection per tab. */
export const db = new BuildStoreDB();
