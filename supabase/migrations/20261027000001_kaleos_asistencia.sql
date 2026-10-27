-- Kaleos: confirmar asistencia a los anuncios de la iglesia (como en eventos de Facebook)
create table if not exists public.kaleos_rsvp (
  message_id bigint not null references public.kaleos_messages(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  answer text not null check (answer in ('si','tal','no')),
  updated_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
create index if not exists kaleos_rsvp_church_idx on public.kaleos_rsvp (church_id);

alter table public.kaleos_rsvp enable row level security;

drop policy if exists kaleos_rsvp_read on public.kaleos_rsvp;
create policy kaleos_rsvp_read on public.kaleos_rsvp for select to authenticated
  using (church_id = public.kaleos_my_church());

drop policy if exists kaleos_rsvp_own on public.kaleos_rsvp;
create policy kaleos_rsvp_own on public.kaleos_rsvp for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and church_id = public.kaleos_my_church()
    and exists (select 1 from public.kaleos_messages m
                where m.id = message_id and m.church_id = public.kaleos_my_church() and m.profile_id is null)
  );

grant select, insert, update, delete on public.kaleos_rsvp to authenticated;
