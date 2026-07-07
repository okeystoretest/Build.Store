-- Build.Store — Supabase schema
-- Money stored as integer centavos. Timestamps in UTC.
-- Run in the Supabase SQL editor or via the CLI.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type payment_method as enum ('cash', 'credit', 'debit', 'pix', 'wallet');
create type order_status as enum ('completed', 'refunded', 'cancelled', 'pending');
create type product_category as enum ('cosmeticos', 'acessorios', 'aromaterapia', 'outros');
create type stock_reason as enum ('sale', 'restock', 'adjustment', 'loss', 'return');

-- ---------------------------------------------------------------------------
-- Stores (multi-tenant: each lojista partner is a store)
-- ---------------------------------------------------------------------------
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles link auth.users to a store with a role.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references stores (id) on delete cascade,
  full_name text,
  birth_date date,
  role text not null default 'vendedora' check (role in ('vendedora', 'lojista', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  sku text not null,
  barcode text,
  name text not null,
  description text,
  category product_category not null default 'outros',
  cost_cents integer not null default 0 check (cost_cents >= 0),
  price_cents integer not null check (price_cents >= 0),
  unit text not null default 'un',
  stock integer not null default 0,
  low_stock_threshold integer not null default 5,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);

create index products_store_category_idx on products (store_id, category);
create index products_barcode_idx on products (barcode);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  phone text,
  document text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Campaigns + goals (Fase A)
-- ---------------------------------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create type goal_type as enum ('general', 'campaign');

create table goals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  seller_id uuid not null references profiles (id) on delete cascade,
  type goal_type not null,
  campaign_id uuid references campaigns (id) on delete cascade,
  target_cents integer,
  target_quantity integer,
  created_at timestamptz not null default now()
);

create index goals_seller_idx on goals (seller_id);

-- ---------------------------------------------------------------------------
-- Orders + items
-- ---------------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  reference text not null,
  customer_id uuid references customers (id) on delete set null,
  customer_name text,
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  total_cents integer not null,
  payment_method payment_method not null,
  tendered_cents integer,
  change_cents integer,
  status order_status not null default 'completed',
  seller_id uuid references profiles (id) on delete set null,
  seller_name text,
  campaign_id uuid references campaigns (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, reference)
);

create index orders_store_created_idx on orders (store_id, created_at desc);
create index orders_status_idx on orders (store_id, status);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid references products (id) on delete set null,
  sku text not null,
  name text not null,
  image_url text,
  unit_price_cents integer not null,
  quantity integer not null check (quantity > 0),
  line_discount_cents integer not null default 0
);

create index order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------------
-- Stock movements (audit trail; drives real-time stock)
-- ---------------------------------------------------------------------------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  delta integer not null,
  reason stock_reason not null,
  order_id uuid references orders (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements (product_id, created_at desc);

-- Applying a movement adjusts product stock atomically.
create or replace function apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update products
     set stock = stock + new.delta,
         updated_at = now()
   where id = new.product_id;
  return new;
end;
$$;

create trigger trg_apply_stock_movement
after insert on stock_movements
for each row execute function apply_stock_movement();

-- ---------------------------------------------------------------------------
-- Row Level Security — every row scoped to the caller's store
-- ---------------------------------------------------------------------------
alter table stores enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table stock_movements enable row level security;
alter table campaigns enable row level security;
alter table goals enable row level security;

-- Helper: the store the current user belongs to.
create or replace function current_store_id()
returns uuid language sql stable as $$
  select store_id from profiles where id = auth.uid();
$$;

create policy "own profile" on profiles
  for select using (id = auth.uid());

create policy "store scoped products" on products
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy "store scoped customers" on customers
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy "store scoped orders" on orders
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy "store scoped order_items" on order_items
  for all using (
    order_id in (select id from orders where store_id = current_store_id())
  );

create policy "store scoped stock_movements" on stock_movements
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy "store scoped campaigns" on campaigns
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

create policy "store scoped goals" on goals
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());
