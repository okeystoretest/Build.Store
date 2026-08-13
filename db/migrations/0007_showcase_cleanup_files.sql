-- 0007 — limpeza da Vitrine devolvendo os arquivos removidos
--
-- A cleanup_showcase(days) da 0006 apaga as linhas e devolve só a CONTAGEM.
-- Com a mídia agora em disco (volume), o cron precisa saber QUAIS arquivos
-- apagar — senão cada expiração deixa um órfão ocupando o volume para sempre.
--
-- Esta função faz o mesmo recorte de retenção e devolve o file_url de cada
-- linha apagada. SECURITY DEFINER porque o cron roda sem sessão de usuário
-- (não há app.current_user_id), então a RLS de showcase_media bloquearia.
--
-- Aplicar como `postgres` (dono das tabelas), nunca como build_app:
--   psql -U postgres -d build_sales -f 0007_showcase_cleanup_files.sql

create or replace function public.cleanup_showcase_files(days integer default 90)
returns setof text
language sql
security definer
set search_path = public
as $$
  delete from public.showcase_media
   where created_at < now() - make_interval(days => days)
  returning file_url;
$$;

revoke all on function public.cleanup_showcase_files(integer) from public;
grant execute on function public.cleanup_showcase_files(integer) to build_app;
