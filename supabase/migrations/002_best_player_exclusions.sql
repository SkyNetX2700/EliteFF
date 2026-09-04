create table if not exists public.best_player_exclusions (
  id serial primary key,
  result_id integer not null unique references public.match_results(id) on delete cascade,
  removed_by integer not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);