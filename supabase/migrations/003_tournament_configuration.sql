-- Tournament creation configuration used by the host form.
-- Keep this migration safe to run against databases created before these fields existed.

alter table public.tournaments
  add column if not exists match_count integer not null default 1,
  add column if not exists maps text,
  add column if not exists kill_points integer not null default 1,
  add column if not exists placements text,
  add column if not exists prize_distribution text;