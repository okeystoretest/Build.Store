-- =============================================================================
-- Vitrine (showcase) — restringe o ENVIO de mídia ao perfil admin
-- =============================================================================
-- Aplique no Supabase (SQL Editor) DEPOIS de 0002_showcase_media.sql.
--
-- Contexto: o upload da Vitrine é feito por chamada direta do cliente Supabase
-- (showcase-repository.ts -> insert em showcase_media), sem passar por rota de
-- API do Next.js. Portanto a camada correta de enforcement é a RLS — esconder o
-- botão na UI não basta. Esta migração troca a policy de INSERT (que hoje
-- permite qualquer autenticado) por uma que só permite quando o perfil do
-- usuário logado em public.profiles for 'admin'.
--
-- SELECT e DELETE seguem como estavam (definidos em 0002). A limpeza dos 90d
-- continua usando a service-role key, que ignora RLS.

-- Substitui a policy de INSERT: só admin envia mídia.
drop policy if exists showcase_media_insert on public.showcase_media;
create policy showcase_media_insert
  on public.showcase_media for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
