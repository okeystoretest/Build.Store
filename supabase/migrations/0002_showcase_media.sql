-- =============================================================================
-- Vitrine (showcase) — armazenamento de mídias por coleção com retenção de 90d
-- =============================================================================
-- Aplique no Supabase (SQL Editor) antes de usar o módulo Vitrine.
-- A limpeza dos 90 dias é feita pela rotina /api/showcase/cleanup (cron).
-- Este arquivo também deixa preparada, opcionalmente, a limpeza via pg_cron.

create table if not exists public.showcase_media (
  id uuid primary key default gen_random_uuid(),
  tab text not null check (tab in ('workshop', 'collection_videos', 'collection_photos')),
  title text not null,
  file_url text not null,
  mime_type text,
  collection_name text not null,
  season text not null check (season in ('primavera_verao', 'outono_inverno')),
  release_month integer not null check (release_month between 1 and 12),
  release_year integer not null,
  created_at timestamptz not null default now()
);

-- Consultas por aba, filtradas por retenção e ordenadas por data (recentes no topo).
create index if not exists showcase_media_tab_created_idx
  on public.showcase_media (tab, created_at desc);

-- Filtro por coleção.
create index if not exists showcase_media_collection_idx
  on public.showcase_media (collection_name);

-- ---------------------------------------------------------------------------
-- RLS: usuários autenticados leem e gerenciam; a limpeza usa service-role
-- (bypassa RLS). Ajuste conforme sua política de papéis, se necessário.
-- ---------------------------------------------------------------------------
alter table public.showcase_media enable row level security;

drop policy if exists showcase_media_select on public.showcase_media;
create policy showcase_media_select
  on public.showcase_media for select
  to authenticated
  using (true);

drop policy if exists showcase_media_insert on public.showcase_media;
create policy showcase_media_insert
  on public.showcase_media for insert
  to authenticated
  with check (true);

drop policy if exists showcase_media_delete on public.showcase_media;
create policy showcase_media_delete
  on public.showcase_media for delete
  to authenticated
  using (true);

-- Realtime: propaga inserts/deletes para todos os dispositivos.
alter publication supabase_realtime add table public.showcase_media;

-- ---------------------------------------------------------------------------
-- (Opcional) Retenção via pg_cron, caso não use o endpoint /api/showcase/cleanup.
-- Requer a extensão pg_cron habilitada no projeto.
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'showcase-retention-90d',
--   '0 3 * * *', -- todo dia às 03:00
--   $$ delete from public.showcase_media where created_at < now() - interval '90 days' $$
-- );
