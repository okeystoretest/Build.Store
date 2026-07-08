-- Build.Store — Correção definitiva de sincronização (erro 500 nos pulls)
-- ==========================================================================
-- Sintoma: em aba anônima ou dispositivo novo, nada aparece (pedidos,
-- relatórios, dashboard) e o console mostra 500 no endpoint REST do Supabase
-- com "[sync] pull ... falhou".
--
-- Causa raiz mais provável: a função current_store_id() no banco NÃO está como
-- SECURITY DEFINER (bancos provisionados com um schema anterior). Sem isso,
-- toda política que a chama ao ler `profiles` entra em RECURSÃO de RLS
-- (Postgres 42P17 "infinite recursion detected in policy for relation
-- profiles") e o PostgREST devolve 500. Como o app é local-first e a UI só lê
-- do Dexie, um pull que falha deixa a base local vazia em sessões novas — daí
-- "nada aparece".
--
-- Este script é IDEMPOTENTE e não apaga dados. Rode-o inteiro no SQL editor do
-- Supabase (Database > SQL). Recria a função como SECURITY DEFINER e reconstrói
-- todas as políticas de forma segura, além de baratear a RLS de order_items e
-- garantir os índices do pull.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1) Função helper — SECURITY DEFINER + search_path fixo.
--    security definer: roda como owner e NÃO re-dispara a RLS de profiles,
--    quebrando o ciclo de recursão. Esta é a correção central do 500.
-- ---------------------------------------------------------------------------
create or replace function current_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from profiles where id = auth.uid();
$$;

-- Garante que o dono da função tenha privilégio para ler profiles sob definer.
-- (No Supabase o owner do schema public já tem; este grant é defensivo.)
grant execute on function current_store_id() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2) RLS habilitada em todas as tabelas (idempotente).
-- ---------------------------------------------------------------------------
alter table stores            enable row level security;
alter table profiles          enable row level security;
alter table products          enable row level security;
alter table customers         enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table stock_movements   enable row level security;
alter table campaigns         enable row level security;
alter table goals             enable row level security;
alter table notifications     enable row level security;
alter table order_counters    enable row level security;

-- ---------------------------------------------------------------------------
-- 3) profiles — leitura do próprio perfil e dos perfis da mesma loja.
--    Ambas seguras porque current_store_id() é SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles
  for select using (id = auth.uid());

drop policy if exists "store profiles read" on profiles;
create policy "store profiles read" on profiles
  for select using (store_id = current_store_id());

-- Permite ao próprio usuário atualizar seu perfil (foto, nome, etc.).
drop policy if exists "own profile update" on profiles;
create policy "own profile update" on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) Tabelas escopadas por store_id — política única "for all".
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) order_items — RLS barata via EXISTS correlacionado (evita materializar
--    a lista de ids da loja inteira e reduz custo/timeout do pull).
-- ---------------------------------------------------------------------------
drop policy if exists "store scoped order_items" on order_items;
create policy "store scoped order_items" on order_items
  for all
  using (
    exists (
      select 1 from orders o
       where o.id = order_items.order_id
         and o.store_id = current_store_id()
    )
  )
  with check (
    exists (
      select 1 from orders o
       where o.id = order_items.order_id
         and o.store_id = current_store_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 6) stores — o usuário lê a própria loja (usado por telas/consultas futuras).
-- ---------------------------------------------------------------------------
drop policy if exists "own store read" on stores;
create policy "own store read" on stores
  for select using (id = current_store_id());

-- ---------------------------------------------------------------------------
-- 7) Índices que sustentam os pulls.
-- ---------------------------------------------------------------------------
create index if not exists orders_store_created_idx
  on orders (store_id, created_at desc);
create index if not exists order_items_order_idx
  on order_items (order_id);
create index if not exists products_store_idx
  on products (store_id);

-- ---------------------------------------------------------------------------
-- 8) Recarrega o cache de schema do PostgREST (aplica policies imediatamente).
-- ---------------------------------------------------------------------------
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 9) DIAGNÓSTICO (opcional) — rode SELECT abaixo para confirmar a correção.
--    Deve retornar prosecdef = true para current_store_id.
-- ---------------------------------------------------------------------------
-- select proname, prosecdef
--   from pg_proc
--  where proname = 'current_store_id';

-- ---------------------------------------------------------------------------
-- 10) DIAGNÓSTICO DE PERFIS ÓRFÃOS
--     Causa comum de "nada aparece" SEM erro 500: o usuário logado não tem
--     linha em `profiles` (ou tem store_id nulo). Nesse caso current_store_id()
--     retorna NULL, as políticas viram `store_id = NULL` e nenhuma linha é
--     visível — mesmo com os dados no banco.
--
--     (a) Usuários de auth SEM profile:
-- select u.id, u.email
--   from auth.users u
--   left join profiles p on p.id = u.id
--  where p.id is null;
--
--     (b) Profiles com store_id nulo:
-- select id, username, store_id from profiles where store_id is null;
--
--     (c) Quantas linhas cada loja tem (sanidade):
-- select store_id, count(*) from orders group by store_id;

-- ---------------------------------------------------------------------------
-- 11) BOOTSTRAP (opcional) — vincula um usuário de auth órfão a uma loja.
--     Use SOMENTE se o diagnóstico (10a/10b) mostrar o seu usuário sem profile
--     ou sem store_id. Ajuste o e-mail e o nome da loja.
--
--     Cria a loja se não existir e insere/《atualiza》o profile do usuário como
--     admin dessa loja. Depois disso, o login desse usuário passa a enxergar os
--     dados da loja.
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   v_user_id uuid;
--   v_store_id uuid;
--   v_email text := 'SEU_EMAIL_DE_LOGIN_AQUI';       -- ex.: dev@okeystore...
--   v_store_name text := 'OKEY STORE';
--   v_username text := 'dev';
-- begin
--   select id into v_user_id from auth.users where email = v_email;
--   if v_user_id is null then
--     raise exception 'Usuário % não encontrado em auth.users', v_email;
--   end if;
--
--   select id into v_store_id from stores where name = v_store_name limit 1;
--   if v_store_id is null then
--     insert into stores (name) values (v_store_name) returning id into v_store_id;
--   end if;
--
--   insert into profiles (id, store_id, username, full_name, role)
--        values (v_user_id, v_store_id, v_username, v_username, 'admin')
--   on conflict (id) do update
--        set store_id = excluded.store_id,
--            role = 'admin';
-- end $$;
