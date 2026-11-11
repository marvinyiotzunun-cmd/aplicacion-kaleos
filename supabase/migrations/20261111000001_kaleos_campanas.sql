-- Kaleos: Campañas (serie de diseños para compartir durante una campaña, p. ej. Escuela Bíblica de Vacaciones)
-- Solo pastor y Secretaría. Las fotos no se suben: se quedan en el teléfono del pastor.
-- Se puede correr más de una vez.
create table if not exists public.kaleos_campaigns (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  title text not null,
  description text,
  starts_on date not null,
  ends_on date not null,
  start_time text,                   -- «19:00»
  place text,
  audience text,
  contact text,
  day_themes text[] not null default '{}',
  verse text,
  verse_ref text,
  style text not null default 'marco' check (style in ('marco','noche','occidente')),
  shared jsonb not null default '{}'::jsonb,   -- pieza → cuándo se compartió
  created_on date not null default current_date,
  created_by uuid references public.kaleos_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 30)
);
create index if not exists kaleos_campaigns_church on public.kaleos_campaigns (church_id, starts_on);
alter table public.kaleos_campaigns enable row level security;
drop policy if exists kaleos_campaigns_staff on public.kaleos_campaigns;
create policy kaleos_campaigns_staff on public.kaleos_campaigns for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());
