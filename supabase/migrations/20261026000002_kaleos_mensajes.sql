-- Kaleos: mensajes del pastor dentro de la app (felicitaciones, invitaciones, recordatorios, avisos)

alter table public.kaleos_profiles add column if not exists email text;

create table if not exists public.kaleos_messages (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid references public.kaleos_profiles(id) on delete cascade, -- null = toda la iglesia
  kind text not null default 'aviso' check (kind in ('felicitacion','invitacion','recordatorio','aviso')),
  title text not null,
  body text,
  card jsonb,
  event_at timestamptz,
  created_by uuid references public.kaleos_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.kaleos_message_reads (
  message_id bigint not null references public.kaleos_messages(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

create index if not exists kaleos_messages_church on public.kaleos_messages (church_id, created_at desc);

alter table public.kaleos_messages enable row level security;
alter table public.kaleos_message_reads enable row level security;

create policy kaleos_messages_read on public.kaleos_messages for select to authenticated
  using (church_id = public.kaleos_my_church() and (profile_id is null or profile_id = auth.uid() or public.kaleos_is_pastor()));
create policy kaleos_messages_pastor on public.kaleos_messages for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

create policy kaleos_message_reads_own on public.kaleos_message_reads for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and exists (
    select 1 from public.kaleos_messages m where m.id = message_id and m.church_id = public.kaleos_my_church()
      and (m.profile_id is null or m.profile_id = auth.uid())));
