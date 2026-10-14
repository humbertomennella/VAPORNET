-- SkyControl schema. Apply only to a dedicated Supabase project for this game.
create extension if not exists pgcrypto;

create type public.skycontrol_role as enum ('pilot', 'atc');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  callsign text unique check (callsign is null or callsign ~ '^[A-Z0-9-]{2,8}$'),
  display_name text not null default 'Aviador',
  preferred_role public.skycontrol_role not null default 'pilot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.flight_records (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.profiles(id) on delete cascade,
  callsign text not null,
  departure_airport text,
  arrival_airport text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  outcome text check (outcome is null or outcome in ('landed', 'aborted', 'incident')),
  score integer check (score is null or score between 0 and 1000),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.flight_events (
  id bigint generated always as identity primary key,
  flight_id uuid not null references public.flight_records(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (length(event_type) between 1 and 64),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index flight_records_pilot_started_idx on public.flight_records(pilot_id, started_at desc);
create index flight_events_flight_created_idx on public.flight_events(flight_id, created_at);

alter table public.profiles enable row level security;
alter table public.flight_records enable row level security;
alter table public.flight_events enable row level security;

create policy "profiles readable by authenticated users" on public.profiles
  for select to authenticated using (true);
create policy "users create own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "pilots read own flight records" on public.flight_records
  for select to authenticated using (pilot_id = auth.uid());
create policy "pilots create own flight records" on public.flight_records
  for insert to authenticated with check (pilot_id = auth.uid());
create policy "pilots update own flight records" on public.flight_records
  for update to authenticated using (pilot_id = auth.uid()) with check (pilot_id = auth.uid());
create policy "pilots delete own flight records" on public.flight_records
  for delete to authenticated using (pilot_id = auth.uid());

create policy "users read events for own flights" on public.flight_events
  for select to authenticated using (
    exists (select 1 from public.flight_records f where f.id = flight_id and f.pilot_id = auth.uid())
  );
create policy "users create events for own flights" on public.flight_events
  for insert to authenticated with check (
    exists (select 1 from public.flight_records f where f.id = flight_id and f.pilot_id = auth.uid())
  );

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'Aviador'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
