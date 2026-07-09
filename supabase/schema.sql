-- =============================================================================
-- Build.Store — Reset completo do banco (SQL Editor do Supabase)
-- =============================================================================
-- Este script:
--   1. Remove TODA a estrutura anterior (tabelas, funções, triggers, policies).
--   2. Recria o schema SEM o conceito de `store_id` (arquitetura de loja única).
--   3. Torna todos os dados GLOBAIS: qualquer usuário autenticado enxerga o
--      mesmo catálogo, estoque, pedidos, campanhas, metas e usuários.
--
-- Modelo de acesso:
--   - Autenticação: usuário + senha via Supabase Auth (e-mail interno derivado
--     do username — ver usernameToEmail no app: "ana silva" -> ana.silva@build.store).
--   - RLS habilitado, mas as políticas liberam leitura/escrita para QUALQUER
--     usuário autenticado (auth.role() = 'authenticated'). Não há isolamento por
--     loja: é uma base única compartilhada.
--
-- COMO USAR: cole tudo no SQL Editor do Supabase e execute uma vez.
-- Rode novamente sempre que quiser zerar a base (ele dropa antes de recriar).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. DROP — elimina qualquer resquício das configurações anteriores.
-- -----------------------------------------------------------------------------
-- Ordem: primeiro triggers/funções que dependem de tabelas, depois as tabelas.
-- CASCADE remove policies, índices e constraints dependentes.

drop trigger if exists trg_apply_stock_movement on public.stock_movements;
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.apply_stock_movement() cascade;
drop function if exists public.current_store_id() cascade;
drop function if exists public.next_order_reference(uuid) cascade;
drop function if exists public.next_order_reference() cascade;
drop function if exists public.handle_new_user() cascade;

drop table if exists public.notifications    cascade;
drop table if exists public.goals            cascade;
drop table if exists public.campaigns        cascade;
drop table if exists public.stock_movements  cascade;
drop table if exists public.order_items      cascade;
drop table if exists public.orders           cascade;
drop table if exists public.customers        cascade;
drop table if exists public.products         cascade;
drop table if exists public.profiles         cascade;
drop table if exists public.stores           cascade;  -- tabela legada multi-loja
drop table if exists public.counters         cascade;

-- -----------------------------------------------------------------------------
-- 1. Extensões
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- 2. PROFILES — 1:1 com auth.users. Sem store_id.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text not null default '',
  birth_date date,
  role       text not null default 'vendedora'
             check (role in ('vendedora','lojista','admin')),
  photo_url  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. PRODUCTS — catálogo/estoque global.
-- -----------------------------------------------------------------------------
create table public.products (
  id                  uuid primary key default gen_random_uuid(),
  sku                 text not null,
  barcode             text,
  name                text not null,
  description         text,
  category            text not null default 'outros',
  cost_cents          integer not null default 0,
  price_cents         integer not null default 0,
  unit                text not null default 'un',
  stock               integer not null default 0,
  low_stock_threshold integer not null default 0,
  color               text,
  size                text,
  grade               jsonb not null default '[]'::jsonb,
  image_url           text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index products_updated_at_idx on public.products (updated_at desc);
create index products_barcode_idx    on public.products (barcode);

-- -----------------------------------------------------------------------------
-- 4. CUSTOMERS
-- -----------------------------------------------------------------------------
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  document   text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 5. ORDERS + ORDER_ITEMS
-- -----------------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null,
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text,
  subtotal_cents  integer not null default 0,
  discount_cents  integer not null default 0,
  total_cents     integer not null default 0,
  payment_method  text not null
                  check (payment_method in ('cash','credit','debit','pix','wallet')),
  tendered_cents  integer,
  change_cents    integer,
  status          text not null default 'completed'
                  check (status in ('completed','refunded','cancelled','pending')),
  seller_id       uuid references public.profiles(id) on delete set null,
  seller_name     text,
  campaign_id     uuid,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index orders_created_at_idx on public.orders (created_at desc);

create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid references public.products(id) on delete set null,
  sku                text not null,
  name               text not null,
  image_url          text,
  unit_price_cents   integer not null default 0,
  quantity           integer not null default 1,
  line_discount_cents integer not null default 0
);
create index order_items_order_id_idx on public.order_items (order_id);

-- -----------------------------------------------------------------------------
-- 6. STOCK_MOVEMENTS — dá baixa/reposição automática via trigger.
-- -----------------------------------------------------------------------------
create table public.stock_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  delta      integer not null,
  reason     text not null
             check (reason in ('sale','restock','adjustment','loss','return')),
  order_id   uuid references public.orders(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id);
create index stock_movements_order_idx   on public.stock_movements (order_id);

-- -----------------------------------------------------------------------------
-- 7. CAMPAIGNS + GOALS
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.goals (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  type            text not null check (type in ('general','campaign')),
  campaign_id     uuid references public.campaigns(id) on delete cascade,
  target_cents    integer,
  target_quantity integer,
  created_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 8. NOTIFICATIONS
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'info',
  title      text not null,
  body       text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 9. COUNTERS — numeração sequencial global de pedidos (#PDD-XXX).
-- -----------------------------------------------------------------------------
create table public.counters (
  id    text primary key,
  value integer not null default 0
);

-- Referência atômica de pedido, agora SEM store_id (contador global único).
create or replace function public.next_order_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.counters (id, value)
  values ('orders', 1)
  on conflict (id) do update set value = public.counters.value + 1
  returning value into v_next;

  return '#PDD-' || lpad(v_next::text, 3, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Trigger de estoque — cada movimento ajusta products.stock.
-- -----------------------------------------------------------------------------
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock = stock + new.delta,
         updated_at = now()
   where id = new.product_id;
  return new;
end;
$$;

create trigger trg_apply_stock_movement
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- -----------------------------------------------------------------------------
-- 11. Bootstrap de profile — cria a linha em profiles quando um auth.user nasce.
--     Usa o username do metadata (ou o local-part do e-mail) como handle.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'vendedora')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 12. RLS — habilitado em todas as tabelas, liberado para qualquer autenticado.
--     Sem isolamento por loja: base única e global.
-- -----------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.products        enable row level security;
alter table public.customers       enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.stock_movements enable row level security;
alter table public.campaigns       enable row level security;
alter table public.goals           enable row level security;
alter table public.notifications   enable row level security;
alter table public.counters        enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','products','customers','orders','order_items',
    'stock_movements','campaigns','goals','notifications','counters'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true);',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

-- =============================================================================
-- Fim. Crie os usuários pelo painel Auth do Supabase (ou pela tela de Gestão do
-- app). O trigger handle_new_user() gera o profile automaticamente. Para o
-- primeiro admin, edite o profile:
--   update public.profiles set role = 'admin' where username = 'seu_usuario';
-- =============================================================================
