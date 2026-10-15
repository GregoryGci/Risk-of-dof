-- Autorise le nouveau mode Cauchemar (3), en conservant tous les scores existants.
-- À exécuter une fois dans le SQL Editor du même projet Supabase.
begin;
alter table public.rod_runs drop constraint if exists rod_runs_difficulty_check;
alter table public.rod_runs add constraint rod_runs_difficulty_check check (difficulty between 0 and 3);
commit;
