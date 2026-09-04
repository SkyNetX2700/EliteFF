-- Elite FF Supabase schema
-- Run this once in Supabase Dashboard -> SQL Editor.
-- The API uses its existing server-side data layer, so browser clients never write these tables directly.

create table if not exists public.users (
  id serial primary key,
  username text not null,
  email text,
  mobile text not null unique,
  password_hash text not null default '$supabase$',
  role text not null default 'player',
  login_method text not null default 'supabase',
  profile_pic text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  points integer not null default 0,
  rank text not null default 'Blaze',
  prestige_stars integer not null default 0,
  total_earnings integer not null default 0,
  weekly_fair_play integer not null default 0,
  last_fair_play_at timestamptz,
  toxic_report_count integer not null default 0,
  point_shifts text,
  apex_reward_given boolean not null default false
);

create table if not exists public.tournaments (
  id serial primary key,
  name text not null,
  type text not null,
  mode text not null,
  map_name text,
  team_size text not null,
  entry_fee integer,
  prize_pool integer,
  booyah_prize integer,
  second_prize integer,
  third_prize integer,
  highest_kill_prize integer,
  max_slots integer not null,
  filled_slots integer not null default 0,
  status text not null default 'upcoming',
  scheduled_at timestamptz not null,
  rules text,
  poster_url text,
  upi_id text,
  qr_url text,
  room_id text,
  room_password text,
  cancel_reason text,
  delay_info text,
  is_paid boolean not null default false,
  timer_enabled boolean not null default true,
  is_private boolean not null default false,
  invite_link text,
  host_id integer not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id serial primary key,
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  user_id integer not null references public.users(id) on delete restrict,
  squad_name text not null,
  player_names text not null,
  payment_screenshot_url text,
  upi_id text,
  utr_number text not null,
  status text not null default 'pending',
  slot_number integer,
  decline_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  tournament_id integer references public.tournaments(id) on delete cascade,
  registration_id integer references public.registrations(id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.match_results (
  id serial primary key,
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  registration_id integer not null references public.registrations(id) on delete cascade,
  match_number integer not null default 1,
  squad_name text not null,
  placement text,
  outcome text,
  kills integer,
  prize integer,
  prize_type text,
  screenshot_url text,
  payment_screenshot_url text,
  proof_of_reward_url text,
  utr_number text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id serial primary key,
  user_id integer references public.users(id) on delete set null,
  name text not null,
  email text,
  message text not null,
  rating integer,
  created_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id serial primary key,
  name text not null,
  email text,
  message text not null,
  via text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.history (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  tournament_name text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scoreboard (
  id serial primary key,
  tournament_id integer not null references public.tournaments(id) on delete cascade,
  registration_id integer not null references public.registrations(id) on delete cascade,
  squad_name text not null,
  kills integer not null default 0,
  rank integer,
  points integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists tournaments_status_idx on public.tournaments(status);
create index if not exists tournaments_scheduled_at_idx on public.tournaments(scheduled_at desc);
create index if not exists registrations_tournament_idx on public.registrations(tournament_id);
create index if not exists registrations_user_idx on public.registrations(user_id);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists results_tournament_idx on public.match_results(tournament_id);

alter table public.users enable row level security;
alter table public.tournaments enable row level security;
alter table public.registrations enable row level security;
alter table public.notifications enable row level security;
alter table public.match_results enable row level security;
alter table public.feedback enable row level security;
alter table public.contacts enable row level security;
alter table public.history enable row level security;
alter table public.scoreboard enable row level security;