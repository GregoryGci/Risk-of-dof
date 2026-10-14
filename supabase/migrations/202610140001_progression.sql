-- À exécuter dans le SQL Editor du projet gwhorrgwaefsvayctqig.
-- Les sauvegardes sont privées. Seul le serveur de jeu peut écrire des scores.
begin;
create table if not exists public.rod_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  character text not null default 'cra',
  display_name text not null default 'Aventurier' check (char_length(display_name) between 1 and 16),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint rod_account_size check (octet_length(data::text) <= 4000000)
);
alter table public.rod_accounts enable row level security;
drop policy if exists rod_account_read on public.rod_accounts;
create policy rod_account_read on public.rod_accounts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists rod_account_insert on public.rod_accounts;
create policy rod_account_insert on public.rod_accounts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists rod_account_update on public.rod_accounts;
create policy rod_account_update on public.rod_accounts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select,insert,update on public.rod_accounts to authenticated;

create table if not exists public.rod_runs (
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  class_id text not null,
  party_size integer not null check (party_size between 1 and 4),
  difficulty integer not null check (difficulty between 0 and 2),
  zone integer not null check (zone between 1 and 255),
  waves integer not null check (waves >= 0),
  kills integer not null check (kills >= 0),
  duration double precision not null check (duration >= 0),
  started_at timestamptz not null,
  summary jsonb not null,
  primary key (run_id,user_id)
);
alter table public.rod_runs enable row level security;
drop policy if exists rod_run_read on public.rod_runs;
create policy rod_run_read on public.rod_runs for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.rod_runs to authenticated;
revoke insert,update,delete on public.rod_runs from anon,authenticated;
create index if not exists rod_run_scores on public.rod_runs(difficulty,party_size,zone desc,waves desc,kills desc);

-- Une meilleure run par joueur, dans chaque mode solo/multi et difficulté.
-- Aucun e-mail, identifiant de connexion, butin ou réglage privé dans le ladder.
create or replace function public.rod_ladder(p_multiplayer boolean default false,p_difficulty integer default 1)
returns table (rank bigint,player_name text,class_id text,party_size integer,zone integer,waves integer,kills integer,duration double precision,started_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.* from public.rod_runs r
    where (r.party_size > 1) = p_multiplayer and r.difficulty = p_difficulty
    order by r.user_id,r.zone desc,r.waves desc,r.kills desc,r.duration asc,r.started_at asc
  )
  select row_number() over (order by b.zone desc,b.waves desc,b.kills desc,b.duration asc,b.started_at asc),
    b.player_name,b.class_id,b.party_size,b.zone,b.waves,b.kills,b.duration,b.started_at
  from best b order by b.zone desc,b.waves desc,b.kills desc,b.duration asc,b.started_at asc limit 100;
$$;
revoke all on function public.rod_ladder(boolean,integer) from public;
grant execute on function public.rod_ladder(boolean,integer) to anon,authenticated;
commit;
