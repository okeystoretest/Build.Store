-- Build.Store — Correção de timeout de sincronização (erro Postgres 57014)
-- "canceling statement due to statement timeout"
--
-- Rode no SQL editor do Supabase. Idempotente e sem perda de dados.
--
-- Contexto: o pull do histórico de pedidos estourava o statement timeout.
-- Duas frentes atacam a causa:
--   1) O app agora limita/pagina o pull (ver supabase-transport.ts) e busca os
--      itens em uma query separada por lista de ids — nada de join aninhado.
--   2) Aqui, tornamos a RLS de order_items mais barata (exists correlacionado
--      em vez de subselect materializado por linha) e garantimos os índices que
--      sustentam essas consultas.
--
-- Observação: o statement timeout padrão do Supabase costuma ser suficiente
-- depois destas mudanças. Se ainda faltar folga em bases muito grandes, a seção
-- final (comentada) mostra como elevar o timeout apenas para o papel
-- "authenticated".

-- ---------------------------------------------------------------------------
-- 1) Índices de apoio (garantia — "if not exists" nunca duplica)
-- ---------------------------------------------------------------------------
create index if not exists orders_store_created_idx
  on orders (store_id, created_at desc);

create index if not exists order_items_order_idx
  on order_items (order_id);

-- ---------------------------------------------------------------------------
-- 2) RLS de order_items mais barata
--    A política antiga: order_id in (select id from orders where store_id = ...)
--    materializa a lista de ids da loja inteira. Trocamos por um EXISTS
--    correlacionado, que o planner resolve por índice (order_items.order_id ->
--    orders.id) sem varrer todos os pedidos da loja.
-- ---------------------------------------------------------------------------
drop policy if exists "store scoped order_items" on order_items;
create policy "store scoped order_items" on order_items
  for all
  using (
    exists (
      select 1
        from orders o
       where o.id = order_items.order_id
         and o.store_id = current_store_id()
    )
  )
  with check (
    exists (
      select 1
        from orders o
       where o.id = order_items.order_id
         and o.store_id = current_store_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 3) (OPCIONAL) Elevar o statement timeout só para usuários autenticados.
--    Descomente se, mesmo após o acima, algum pull grande ainda expirar.
--    15s dá folga para o pull inicial sem afrouxar o timeout global.
-- ---------------------------------------------------------------------------
-- alter role authenticated set statement_timeout = '15s';
-- notify pgrst, 'reload config';
