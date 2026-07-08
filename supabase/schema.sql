-- Build.Store — Supabase schema (atualizado)
-- Money stored as integer centavos. Timestamps in UTC.
-- Run in the Supabase SQL editor or via the CLI.
-- Idempotent: safe to re-run over an existing database without data loss.
--
-- Este arquivo é a fonte de verdade do backend e espelha o modelo de domínio
-- em src/types/domain.ts. Além das tabelas originais, esta versão adiciona:
--   • products.color / products.size      (grade de peças)
--   • profiles.photo_url / profiles.active (foto e status do usuário)
--   • notifications                        (sino de notificações)
--   • order_counters + next_order_reference (numeração #PDD-XXX por loja)
-- Todas as adições usam "add column if not exists" / "create table if not
-- exists" para migração segura sobre bases já existentes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (guarded — create type has no "if not exists")
-- ---------------------------------------------------------------------------
do $$ begin
  create type payment_method as enum ('cash', 'credit', 'debit', 'pix', 'wallet');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('completed', 'refunded', 'cancelled', 'pending');
exception when duplicate_object then null; end $$;

do $$ begin
  create type product_category as enum ('cosmeticos', 'acessorios', 'aromaterapia', 'outros');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_reason as enum ('sale', 'restock', 'adjustment', 'loss', 'return');
exception when duplicate_object then null; end $$;

do $$ begin
  create type goal_type as enum ('general', 'campaign');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_kind as enum ('product_added', 'info');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Stores (multi-tenant: each lojista partner is a store)
-- ---------------------------------------------------------------------------
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles link auth.users to a store with a role.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references stores (id) on delete cascade,
  username text not null unique,
  full_name text,
  birth_date date,
  role text not null default 'vendedora' check (role in ('vendedora', 'lojista', 'admin')),
  photo_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Migrations para bases criadas em versões anteriores.
alter table profiles add column if not exists username text;
alter table profiles add column if not exists photo_url text;
alter table profiles add column if not exists active boolean not null default true;
-- Só adiciona a UNIQUE em (username) se ainda não existir. Quando a tabela é
-- criada por este mesmo script, "username text unique" já cria a constraint
-- automática profiles_username_key — recriá-la lança 42P07 (duplicate_table).
do $$ begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'profiles'::regclass
       and contype = 'u'
       and conkey = array[
         (select attnum from pg_attribute
           where attrelid = 'profiles'::regclass and attname = 'username')
       ]
  ) then
    alter table profiles add constraint profiles_username_key unique (username);
  end if;
exception when duplicate_table or duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------
create table if not exists products (
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
  color text,
  size text,
  grade jsonb not null default '[]'::jsonb,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);

-- Migrations: grade de peças (cor/tamanho) para bases já existentes.
alter table products add column if not exists color text;
alter table products add column if not exists size text;
alter table products add column if not exists grade jsonb not null default '[]'::jsonb;

create index if not exists products_store_category_idx on products (store_id, category);
create index if not exists products_barcode_idx on products (barcode);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
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
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  seller_id uuid not null references profiles (id) on delete cascade,
  type goal_type not null,
  campaign_id uuid references campaigns (id) on delete cascade,
  target_cents integer,
  target_quantity integer,
  created_at timestamptz not null default now()
);

create index if not exists goals_seller_idx on goals (seller_id);

-- ---------------------------------------------------------------------------
-- Orders + items
-- ---------------------------------------------------------------------------
create table if not exists orders (
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

create index if not exists orders_store_created_idx on orders (store_id, created_at desc);
create index if not exists orders_status_idx on orders (store_id, status);

create table if not exists order_items (
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

create index if not exists order_items_order_idx on order_items (order_id);

-- ---------------------------------------------------------------------------
-- Order counters (numeração sequencial #PDD-XXX por loja)
-- Localmente a numeração vive no Dexie (tabela counters). No servidor, cada
-- loja tem seu próprio contador para gerar referências sem colisão entre
-- dispositivos. next_order_reference() incrementa de forma atômica.
-- ---------------------------------------------------------------------------
create table if not exists order_counters (
  store_id uuid primary key references stores (id) on delete cascade,
  value integer not null default 0
);

create or replace function next_order_reference(p_store_id uuid)
returns text language plpgsql as $$
declare
  next_val integer;
begin
  insert into order_counters (store_id, value)
       values (p_store_id, 1)
  on conflict (store_id)
    do update set value = order_counters.value + 1
  returning value into next_val;

  return '#PDD-' || lpad(next_val::text, 3, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications (sino de notificações; product_added, info)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  kind notification_kind not null default 'info',
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_store_created_idx on notifications (store_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Stock movements (audit trail; drives real-time stock)
-- ---------------------------------------------------------------------------
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  delta integer not null,
  reason stock_reason not null,
  order_id uuid references orders (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements (product_id, created_at desc);

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

drop trigger if exists trg_apply_stock_movement on stock_movements;
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
alter table notifications enable row level security;
alter table order_counters enable row level security;

-- Helper: the store the current user belongs to.
-- SECURITY DEFINER + search_path fixo: roda com privilégios do dono e NÃO
-- re-dispara a RLS de profiles. Isso é essencial — sem isso, políticas que
-- chamam current_store_id() ao ler profiles entrariam em recursão infinita
-- ("infinite recursion detected in policy for relation profiles").
create or replace function current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from profiles where id = auth.uid();
$$;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for select using (id = auth.uid());

-- Perfis da mesma loja podem ser lidos (atribuição de vendedora, etc.).
-- Seguro agora que current_store_id() é SECURITY DEFINER (não recursa).
drop policy if exists "store profiles read" on profiles;
create policy "store profiles read" on profiles
  for select using (store_id = current_store_id());

drop policy if exists "store scoped products" on products;
create policy "store scoped products" on products
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped customers" on customers;
create policy "store scoped customers" on customers
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped orders" on orders;
create policy "store scoped orders" on orders
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped order_items" on order_items;
create policy "store scoped order_items" on order_items
  for all using (
    order_id in (select id from orders where store_id = current_store_id())
  );

drop policy if exists "store scoped stock_movements" on stock_movements;
create policy "store scoped stock_movements" on stock_movements
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped campaigns" on campaigns;
create policy "store scoped campaigns" on campaigns
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped goals" on goals;
create policy "store scoped goals" on goals
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped notifications" on notifications;
create policy "store scoped notifications" on notifications
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());

drop policy if exists "store scoped order_counters" on order_counters;
create policy "store scoped order_counters" on order_counters
  for all using (store_id = current_store_id())
  with check (store_id = current_store_id());
