-- Shared host branding, normalized UTR protection, and Vercel screenshot storage.

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values
  ('app_name', 'ELITE FF'),
  ('app_logo_url', '/Elite_1777629983897.png')
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

create unique index if not exists registrations_utr_number_unique_idx
  on public.registrations (
    upper(regexp_replace(trim(utr_number), '\s+', '', 'g'))
  )
  where trim(utr_number) not in ('', '-');

-- Supabase Storage is used by the Vercel adapter for player payment proofs.
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('tournament-posters', 'tournament-posters', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('match-results', 'match-results', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Authenticated players can upload payment screenshots" on storage.objects;
create policy "Authenticated players can upload payment screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated users can upload tournament posters" on storage.objects;
create policy "Authenticated users can upload tournament posters"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tournament-posters'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Authenticated hosts can upload match results" on storage.objects;
create policy "Authenticated hosts can upload match results"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-results'
    and (storage.foldername(name))[1] = auth.uid()::text
  );