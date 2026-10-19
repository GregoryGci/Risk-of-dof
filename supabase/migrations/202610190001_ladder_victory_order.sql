-- No account, currency, history or existing score is removed.
-- A victory ranks above a defeat in the same zone, before wave/kill tie breakers.
begin;
create or replace function public.rod_ladder(p_multiplayer boolean default false,p_difficulty integer default 1)
returns table (rank bigint,player_name text,class_id text,party_size integer,zone integer,waves integer,kills integer,duration double precision,started_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.*,
      (coalesce(r.summary->>'outcome','') = 'victory') as won
    from public.rod_runs r
    where (r.party_size > 1) = p_multiplayer and r.difficulty = p_difficulty
    order by r.user_id,r.zone desc,(coalesce(r.summary->>'outcome','') = 'victory') desc,
      r.waves desc,r.kills desc,r.duration asc,r.started_at asc,r.run_id
  )
  select row_number() over (order by b.zone desc,b.won desc,b.waves desc,b.kills desc,b.duration asc,b.started_at asc,b.user_id),
    b.player_name,b.class_id,b.party_size,b.zone,b.waves,b.kills,b.duration,b.started_at
  from best b
  order by b.zone desc,b.won desc,b.waves desc,b.kills desc,b.duration asc,b.started_at asc,b.user_id limit 100;
$$;
revoke all on function public.rod_ladder(boolean,integer) from public;
grant execute on function public.rod_ladder(boolean,integer) to anon,authenticated;
commit;
