-- Build.Store — Vincular usuários órfãos à loja (correção de "nada aparece")
-- ==========================================================================
-- Diagnóstico confirmou: os usuários abaixo existem em auth.users mas NÃO têm
-- linha em `profiles`. Sem profile, current_store_id() retorna NULL e a RLS
-- esconde todos os dados da loja — por isso pedidos/relatórios/dashboard ficam
-- vazios ao logar com eles.
--
--   vendas@build.store         -> vendedora
--   marcos.lucas@build.store   -> admin
--
-- Este script:
--   1) descobre automaticamente a loja onde os dados JÁ existem (a com mais
--      pedidos; desempate por produtos; se o banco estiver vazio de pedidos e
--      produtos, usa a primeira/única loja);
--   2) cria os dois profiles vinculados a essa loja, com os papéis corretos;
--   3) é idempotente (on conflict do update) e não apaga dados.
--
-- Rode INTEIRO no SQL editor do Supabase. Depois, faça logout/login.
-- ==========================================================================

do $$
declare
  v_store_id uuid;
  v_marcos   uuid;
  v_vendas   uuid;
begin
  -- 1) Loja que contém os dados existentes.
  select o.store_id
    into v_store_id
    from orders o
   group by o.store_id
   order by count(*) desc
   limit 1;

  if v_store_id is null then
    -- Sem pedidos ainda: tenta pela tabela de produtos.
    select p.store_id
      into v_store_id
      from products p
     group by p.store_id
     order by count(*) desc
     limit 1;
  end if;

  if v_store_id is null then
    -- Banco novo: usa a única/primeira loja. Se não houver loja, cria uma.
    select id into v_store_id from stores order by created_at limit 1;
  end if;

  if v_store_id is null then
    insert into stores (name) values ('OKEY STORE') returning id into v_store_id;
  end if;

  -- 2) Resolve os ids dos usuários de auth pelos e-mails.
  select id into v_marcos from auth.users where email = 'marcos.lucas@build.store';
  select id into v_vendas from auth.users where email = 'vendas@build.store';

  -- 3) Cria/atualiza os profiles vinculados à loja.
  if v_marcos is not null then
    insert into profiles (id, store_id, username, full_name, role, active)
         values (v_marcos, v_store_id, 'marcos.lucas', 'Marcos Lucas', 'admin', true)
    on conflict (id) do update
         set store_id = excluded.store_id,
             role     = 'admin',
             active   = true;
  else
    raise notice 'Usuário marcos.lucas@build.store não encontrado em auth.users';
  end if;

  if v_vendas is not null then
    insert into profiles (id, store_id, username, full_name, role, active)
         values (v_vendas, v_store_id, 'vendas', 'Vendas', 'vendedora', true)
    on conflict (id) do update
         set store_id = excluded.store_id,
             role     = 'vendedora',
             active   = true;
  else
    raise notice 'Usuário vendas@build.store não encontrado em auth.users';
  end if;

  raise notice 'Profiles vinculados à loja %', v_store_id;
end $$;

-- Recarrega o cache do PostgREST.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação: deve listar os dois usuários com store_id preenchido.
-- ---------------------------------------------------------------------------
select p.username, p.role, p.store_id, u.email
  from profiles p
  join auth.users u on u.id = p.id
 where u.email in ('marcos.lucas@build.store', 'vendas@build.store');
