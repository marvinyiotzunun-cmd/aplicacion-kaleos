-- Kaleos: Saludos del pastor (tarjetas por cumpleaños, aniversarios y fechas especiales)

alter table public.kaleos_profiles add column if not exists wedding_date date;
alter table public.kaleos_churches add column if not exists greeting_signature text;

-- Fechas especiales que el pastor agrega a mano (graduación, nacimiento de un bebé…)
create table if not exists public.kaleos_special_dates (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  label text not null,
  event_date date not null,
  yearly boolean not null default false,
  created_by uuid references public.kaleos_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Bitácora de saludos enviados (evita repetir el mismo saludo)
create table if not exists public.kaleos_greetings (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  occasion text not null,
  occasion_date date not null,
  template text,
  message text,
  sent_at timestamptz not null default now(),
  sent_by uuid references public.kaleos_profiles(id) on delete set null,
  unique (profile_id, occasion, occasion_date)
);

create index if not exists kaleos_special_dates_church on public.kaleos_special_dates (church_id);
create index if not exists kaleos_greetings_church on public.kaleos_greetings (church_id, occasion_date);

alter table public.kaleos_special_dates enable row level security;
alter table public.kaleos_greetings enable row level security;

create policy kaleos_special_dates_pastor on public.kaleos_special_dates for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

create policy kaleos_greetings_pastor on public.kaleos_greetings for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());
