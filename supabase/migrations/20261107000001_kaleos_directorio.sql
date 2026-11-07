-- Kaleos: directorio de hermanos sin cuenta y calendario de la iglesia
-- Sirve para precargar lo visto en Facebook y WhatsApp antes de que cada hermano tenga su número LL-xxxx.
-- Se puede correr más de una vez.

-- Datos de la iglesia que faltaban
alter table public.kaleos_churches add column if not exists address text;
alter table public.kaleos_churches add column if not exists facebook_url text;
alter table public.kaleos_churches add column if not exists founded_year int;
alter table public.kaleos_churches add column if not exists anniversary_month smallint check (anniversary_month between 1 and 12);
alter table public.kaleos_churches add column if not exists anniversary_day smallint check (anniversary_day between 1 and 31);
alter table public.kaleos_churches add column if not exists daily_greeting text;

-- ===== Directorio: personas conocidas, con o sin cuenta =====
create table if not exists public.kaleos_directory (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  full_name text not null,
  nickname text,
  title text,                        -- Hno., Hna., Pastora…
  role_label text,                   -- cómo se le conoce: Obrero Nacional, coordinador de Misiones…
  phone text,
  birthday_month smallint check (birthday_month between 1 and 12),
  birthday_day smallint check (birthday_day between 1 and 31),
  birth_year int,
  wedding_month smallint check (wedding_month between 1 and 12),
  wedding_day smallint check (wedding_day between 1 and 31),
  notes text,
  source text,                       -- de dónde salió el dato
  confidence text not null default 'media' check (confidence in ('alta','media','baja')),
  consent text not null default 'pendiente' check (consent in ('pendiente','si','no')),
  profile_id uuid references public.kaleos_profiles(id) on delete set null,  -- cuando ya tiene cuenta
  created_at timestamptz not null default now(),
  unique (church_id, full_name)
);
create index if not exists kaleos_directory_church on public.kaleos_directory (church_id, birthday_month, birthday_day);
alter table public.kaleos_directory enable row level security;
drop policy if exists kaleos_directory_staff on public.kaleos_directory;
create policy kaleos_directory_staff on public.kaleos_directory for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- ===== Calendario: fechas fijas de la iglesia (anuales, mensuales, semanales) =====
create table if not exists public.kaleos_calendar (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  month smallint check (month between 1 and 12),      -- vacío = todos los meses
  day smallint check (day between 1 and 31),          -- vacío = regla en «rule»
  kind text not null check (kind in ('aniversario','recurrente','actividad','reconocimiento','tema')),
  title text not null,
  rule text,                         -- «primer domingo», «último domingo», «primera semana, L-V 19:00»…
  recurrence text not null default 'anual' check (recurrence in ('anual','mensual','semanal','unica')),
  confidence text not null default 'media' check (confidence in ('alta','media','baja')),
  verified boolean not null default false,  -- el pastor lo confirmó
  notes text,
  created_at timestamptz not null default now(),
  unique (church_id, month, day, title)
);
create index if not exists kaleos_calendar_church on public.kaleos_calendar (church_id, month, day);
alter table public.kaleos_calendar enable row level security;
drop policy if exists kaleos_calendar_read on public.kaleos_calendar;
create policy kaleos_calendar_read on public.kaleos_calendar for select to authenticated
  using (church_id = public.kaleos_my_church() and (verified or public.kaleos_is_staff()));
drop policy if exists kaleos_calendar_staff on public.kaleos_calendar;
create policy kaleos_calendar_staff on public.kaleos_calendar for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());
