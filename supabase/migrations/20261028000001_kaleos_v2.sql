-- Kaleos 2: perfil Secretario-Tesorero, niveles del miembro, comunidades, anuncios dirigidos,
-- versículos del pastor, agenda, turnos de servicio y mayordomía.
-- Se puede correr más de una vez.

-- ===== 1. Perfil Secretario-Tesorero =====
alter table public.kaleos_profiles drop constraint if exists kaleos_profiles_role_check;
alter table public.kaleos_profiles add constraint kaleos_profiles_role_check
  check (role in ('member','usher','pastor','secretary'));

create or replace function public.kaleos_is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kaleos_my_role() in ('pastor','secretary'), false)
$$;
create or replace function public.kaleos_is_secretary() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kaleos_my_role() = 'secretary', false)
$$;

-- ===== 2. Niveles: adherente, neófito, miembro, líder, consejero =====
do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'kaleos_profiles' and column_name = 'level') then
    alter table public.kaleos_profiles add column level text not null default 'adherente'
      check (level in ('adherente','neofito','miembro','lider','consejero'));
    update public.kaleos_profiles set level = case stage
      when 'visitante' then 'adherente' when 'miembro' then 'neofito'
      when 'bautizado' then 'miembro' when 'grupo' then 'miembro'
      else 'lider' end;
  end if;
end $$;

create or replace function public.kaleos_my_level() returns text
language sql stable security definer set search_path = public as $$
  select level from public.kaleos_profiles where id = auth.uid() and active
$$;

-- El pastor y Secretaría ven y editan a los hermanos; solo el pastor cambia el perfil (rol) de alguien
drop policy if exists kaleos_profiles_read on public.kaleos_profiles;
create policy kaleos_profiles_read on public.kaleos_profiles for select to authenticated
  using (id = auth.uid() or (church_id = public.kaleos_my_church() and public.kaleos_is_staff()));
drop policy if exists kaleos_profiles_pastor_update on public.kaleos_profiles;
drop policy if exists kaleos_profiles_staff_update on public.kaleos_profiles;
create policy kaleos_profiles_staff_update on public.kaleos_profiles for update to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church());

create or replace function public.kaleos_guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.kaleos_is_pastor() and new.role is distinct from old.role then
    raise exception 'Solo el pastor cambia el perfil de una persona';
  end if;
  return new;
end $$;
drop trigger if exists kaleos_profiles_guard on public.kaleos_profiles;
create trigger kaleos_profiles_guard before update on public.kaleos_profiles
for each row execute function public.kaleos_guard_profile();

-- Secretaría también registra asistencia y ve la de todos
drop policy if exists kaleos_attendance_read on public.kaleos_attendance;
create policy kaleos_attendance_read on public.kaleos_attendance for select to authenticated
  using (profile_id = auth.uid() or (church_id = public.kaleos_my_church() and public.kaleos_my_role() in ('pastor','usher','secretary')));

create or replace function public.kaleos_check_in(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.kaleos_my_role();
  v_church uuid := public.kaleos_my_church();
  v_me uuid := auth.uid();
  v_p public.kaleos_profiles;
  v_today date := (now() at time zone 'America/Guatemala')::date;
  v_new boolean := false;
  v_streak int := 0;
  d date;
begin
  if v_role is null or v_role not in ('usher','pastor','secretary') then
    raise exception 'Solo el ujier, Secretaría o el pastor pueden registrar asistencia';
  end if;
  select * into v_p from public.kaleos_profiles
  where church_id = v_church and active
    and (qr_token::text = lower(trim(p_code)) or upper(member_no) = upper(trim(p_code)));
  if not found then
    return json_build_object('ok', false, 'error', 'Código no reconocido');
  end if;
  insert into public.kaleos_attendance (church_id, profile_id, service_date, scanned_by)
  values (v_church, v_p.id, v_today, v_me)
  on conflict (profile_id, service_date) do nothing;
  v_new := found;
  d := v_today - ((extract(dow from v_today))::int);
  if not exists (select 1 from public.kaleos_attendance where profile_id = v_p.id and service_date = d) then
    d := d - 7;
  end if;
  loop
    exit when not exists (select 1 from public.kaleos_attendance where profile_id = v_p.id and service_date = d);
    v_streak := v_streak + 1;
    d := d - 7;
  end loop;
  return json_build_object('ok', true, 'new', v_new, 'name', v_p.full_name,
    'title', v_p.title, 'member_no', v_p.member_no, 'streak', v_streak);
end $$;

-- El reporte del mes lo ven el pastor y Secretaría
create or replace function public.kaleos_month_report(p_month date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_church uuid := public.kaleos_my_church();
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  if not public.kaleos_is_staff() then raise exception 'Solo el pastor o Secretaría'; end if;
  return json_build_object(
    'month', m0,
    'attendance_avg', (select coalesce(round(avg(c)), 0) from (
        select count(*) c from public.kaleos_attendance
        where church_id = v_church and service_date >= m0 and service_date < m1
        group by service_date) s),
    'services', (select count(distinct service_date) from public.kaleos_attendance
        where church_id = v_church and service_date >= m0 and service_date < m1),
    'new_members', (select count(*) from public.kaleos_steps st join public.kaleos_profiles p on p.id = st.profile_id
        where p.church_id = v_church and st.step = 'miembro' and st.achieved_on >= m0 and st.achieved_on < m1),
    'baptisms', (select count(*) from public.kaleos_profiles
        where church_id = v_church and baptism_date >= m0 and baptism_date < m1),
    'visits', (select count(*) from public.kaleos_visits
        where church_id = v_church and visited_on >= m0 and visited_on < m1),
    'new_leaders', (select count(*) from public.kaleos_steps st join public.kaleos_profiles p on p.id = st.profile_id
        where p.church_id = v_church and st.step = 'lider' and st.achieved_on >= m0 and st.achieved_on < m1),
    'prayers', (select count(*) from public.kaleos_prayer_requests
        where church_id = v_church and kind = 'oracion' and created_at >= m0 and created_at < m1),
    'requests', (select count(*) from public.kaleos_prayer_requests
        where church_id = v_church and created_at >= m0 and created_at < m1),
    'members_total', (select count(*) from public.kaleos_profiles where church_id = v_church and active)
  );
end $$;

-- Asistencia de los domingos (últimas semanas) para los informes
create or replace function public.kaleos_attendance_weeks(p_weeks int default 8)
returns table (service_date date, people bigint)
language sql stable security definer set search_path = public as $$
  select a.service_date, count(*) from public.kaleos_attendance a
  where public.kaleos_is_staff() and a.church_id = public.kaleos_my_church()
    and a.service_date > (now() at time zone 'America/Guatemala')::date - (p_weeks * 7)
  group by a.service_date order by a.service_date
$$;

-- ===== 3. Comunidades =====
create table if not exists public.kaleos_communities (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  slug text not null,
  name text not null,
  subtitle text,
  emblem text not null default 'comunidades',
  palette text not null default 'alba',
  style text not null default 'cumbres',
  seed int not null default 3,
  leader_id uuid references public.kaleos_profiles(id) on delete set null,
  meets text,
  whatsapp_url text,
  guidance text,
  guidance_at timestamptz,
  sub_note text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (church_id, slug)
);
create table if not exists public.kaleos_community_members (
  community_id bigint not null references public.kaleos_communities(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, profile_id)
);
create index if not exists kaleos_community_members_profile on public.kaleos_community_members (profile_id);
alter table public.kaleos_communities enable row level security;
alter table public.kaleos_community_members enable row level security;

drop policy if exists kaleos_communities_read on public.kaleos_communities;
create policy kaleos_communities_read on public.kaleos_communities for select to authenticated
  using (church_id = public.kaleos_my_church());
drop policy if exists kaleos_communities_staff on public.kaleos_communities;
create policy kaleos_communities_staff on public.kaleos_communities for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

drop policy if exists kaleos_community_members_read on public.kaleos_community_members;
create policy kaleos_community_members_read on public.kaleos_community_members for select to authenticated
  using (profile_id = auth.uid() or (public.kaleos_is_staff() and exists (
    select 1 from public.kaleos_communities c where c.id = community_id and c.church_id = public.kaleos_my_church())));
drop policy if exists kaleos_community_members_staff on public.kaleos_community_members;
create policy kaleos_community_members_staff on public.kaleos_community_members for all to authenticated
  using (public.kaleos_is_staff() and exists (
    select 1 from public.kaleos_communities c where c.id = community_id and c.church_id = public.kaleos_my_church()))
  with check (public.kaleos_is_staff() and exists (
    select 1 from public.kaleos_communities c where c.id = community_id and c.church_id = public.kaleos_my_church()));

create or replace function public.kaleos_in_community(p_id bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kaleos_community_members where community_id = p_id and profile_id = auth.uid())
$$;

-- Comunidades con su número de integrantes, su encargado y si el usuario es parte
create or replace function public.kaleos_communities_overview()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.sort, x.name), '[]') from (
    select c.id, c.slug, c.name, c.subtitle, c.emblem, c.palette, c.style, c.seed, c.meets, c.whatsapp_url,
      c.guidance, c.guidance_at, c.sub_note, c.sort, c.leader_id,
      (select full_name from public.kaleos_profiles p where p.id = c.leader_id) as leader_name,
      (select count(*) from public.kaleos_community_members m join public.kaleos_profiles p on p.id = m.profile_id
        where m.community_id = c.id and p.active) as members,
      exists (select 1 from public.kaleos_community_members m where m.community_id = c.id and m.profile_id = auth.uid()) as mine
    from public.kaleos_communities c where c.church_id = public.kaleos_my_church()
  ) x
$$;

-- Integrantes de una comunidad (solo para sus integrantes, el pastor y Secretaría)
create or replace function public.kaleos_community_people(p_id bigint)
returns table (id uuid, full_name text, title text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.title from public.kaleos_community_members m
  join public.kaleos_profiles p on p.id = m.profile_id
  join public.kaleos_communities c on c.id = m.community_id
  where m.community_id = p_id and p.active and c.church_id = public.kaleos_my_church()
    and (public.kaleos_is_staff() or public.kaleos_in_community(p_id))
  order by p.full_name
$$;

-- Comunidades reales de La Línea
insert into public.kaleos_communities (church_id, slug, name, subtitle, emblem, palette, style, seed, sort, sub_note)
select ch.id, v.slug, v.name, v.subtitle, v.emblem, v.palette, v.style, v.seed, v.sort, v.sub_note
from public.kaleos_churches ch, (values
  ('emergente', 'Generación Emergente', 'Jóvenes', 'c_emergente', 'alba', 'cumbres', 4, 1, null),
  ('diaconos', 'Diáconos', 'Servidores', 'c_diaconos', 'oro', 'luz', 7, 2, null),
  ('plata', 'Cabellos de Plata', 'Ancianos', 'c_plata', 'lino', 'lienzo', 2, 3, null),
  ('damas', 'Damas', 'Mujeres de la iglesia', 'c_damas', 'vino', 'aurora', 9, 4, null),
  ('caballeros', 'Caballeros', 'Hombres de la iglesia', 'c_caballeros', 'mar', 'olas', 5, 5, null),
  ('infantil', 'Iglesia Infantil', 'Niños y maestros', 'c_infantil', 'cielo', 'luz', 12, 6, null),
  ('misiones', 'Misiones', 'Envíos y apoyo', 'c_misiones', 'ocaso', 'cumbres', 15, 7, null),
  ('multimedia', 'Multimedia', 'Sonido, cámaras y pantallas', 'c_multimedia', 'mar', 'aurora', 21, 8, null),
  ('alabanza', 'Alabanza', 'Con su ministerio de Danza', 'c_alabanza', 'ocaso', 'olas', 8, 9, 'Ministerio de Danza')
) as v(slug, name, subtitle, emblem, palette, style, seed, sort, sub_note)
where ch.slug = 'la-linea'
on conflict (church_id, slug) do nothing;

-- ===== 4. Anuncios para una comunidad o para ciertos niveles =====
alter table public.kaleos_messages
  add column if not exists community_id bigint references public.kaleos_communities(id) on delete cascade,
  add column if not exists levels text[],
  add column if not exists place text,
  add column if not exists art jsonb;

drop policy if exists kaleos_messages_read on public.kaleos_messages;
create policy kaleos_messages_read on public.kaleos_messages for select to authenticated
  using (church_id = public.kaleos_my_church() and (
    public.kaleos_is_staff() or profile_id = auth.uid()
    or (profile_id is null
        and (community_id is null or public.kaleos_in_community(community_id))
        and (levels is null or public.kaleos_my_level() = any(levels)))));
drop policy if exists kaleos_messages_pastor on public.kaleos_messages;
drop policy if exists kaleos_messages_staff on public.kaleos_messages;
create policy kaleos_messages_staff on public.kaleos_messages for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- ===== 5. Versículos que publica el pastor (versículo del día) =====
create table if not exists public.kaleos_verses (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  ref text not null,
  body text not null,
  style jsonb,
  created_by uuid references public.kaleos_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists kaleos_verses_church on public.kaleos_verses (church_id, created_at desc);
alter table public.kaleos_verses enable row level security;
drop policy if exists kaleos_verses_read on public.kaleos_verses;
create policy kaleos_verses_read on public.kaleos_verses for select to authenticated
  using (church_id = public.kaleos_my_church());
drop policy if exists kaleos_verses_staff on public.kaleos_verses;
create policy kaleos_verses_staff on public.kaleos_verses for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- ===== 6. Agenda del pastor: recordatorios propios =====
create table if not exists public.kaleos_reminders (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.kaleos_profiles(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists kaleos_reminders_owner on public.kaleos_reminders (owner_id, due_at);
alter table public.kaleos_reminders enable row level security;
drop policy if exists kaleos_reminders_own on public.kaleos_reminders;
create policy kaleos_reminders_own on public.kaleos_reminders for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and church_id = public.kaleos_my_church());

-- ===== 7. Bitácora del pastor y nota interna de Secretaría =====
create table if not exists public.kaleos_logbook (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  author_id uuid default auth.uid() references public.kaleos_profiles(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists kaleos_logbook_profile on public.kaleos_logbook (profile_id, created_at desc);
alter table public.kaleos_logbook enable row level security;
drop policy if exists kaleos_logbook_pastor on public.kaleos_logbook;
create policy kaleos_logbook_pastor on public.kaleos_logbook for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

create table if not exists public.kaleos_staff_notes (
  profile_id uuid primary key references public.kaleos_profiles(id) on delete cascade,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.kaleos_staff_notes enable row level security;
drop policy if exists kaleos_staff_notes_staff on public.kaleos_staff_notes;
create policy kaleos_staff_notes_staff on public.kaleos_staff_notes for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- El pastor y Secretaría ven las visitas (para la bitácora y los informes)
drop policy if exists kaleos_visits_staff_read on public.kaleos_visits;
create policy kaleos_visits_staff_read on public.kaleos_visits for select to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- ===== 8. Turnos de servicio (ujieres, alabanza, multimedia, limpieza) =====
create table if not exists public.kaleos_services (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  service_date date not null,
  activity text not null,
  usher_id uuid references public.kaleos_profiles(id) on delete set null,
  worship_id uuid references public.kaleos_profiles(id) on delete set null,
  media_id uuid references public.kaleos_profiles(id) on delete set null,
  cleaning_id bigint references public.kaleos_communities(id) on delete set null,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kaleos_services_church on public.kaleos_services (church_id, service_date);
alter table public.kaleos_services enable row level security;
drop policy if exists kaleos_services_staff on public.kaleos_services;
create policy kaleos_services_staff on public.kaleos_services for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_staff());

-- ===== 9. Mayordomía =====
alter table public.kaleos_churches add column if not exists giving_info text;   -- cuenta para transferencias
alter table public.kaleos_churches add column if not exists whatsapp_url text;  -- comunidad de WhatsApp de la iglesia
drop policy if exists kaleos_churches_pastor_update on public.kaleos_churches;
drop policy if exists kaleos_churches_staff_update on public.kaleos_churches;
create policy kaleos_churches_staff_update on public.kaleos_churches for update to authenticated
  using (id = public.kaleos_my_church() and public.kaleos_is_staff())
  with check (id = public.kaleos_my_church());

create table if not exists public.kaleos_funds (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  kind text not null check (kind in ('proyecto','necesidad')),
  name text not null,
  subtitle text,
  goal numeric(12,2) not null default 0,
  until_label text,
  palette text not null default 'alba',
  style text not null default 'cumbres',
  emblem text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.kaleos_funds enable row level security;
drop policy if exists kaleos_funds_read on public.kaleos_funds;
create policy kaleos_funds_read on public.kaleos_funds for select to authenticated
  using (church_id = public.kaleos_my_church());
drop policy if exists kaleos_funds_secretary on public.kaleos_funds;
create policy kaleos_funds_secretary on public.kaleos_funds for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_secretary())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_secretary());

create table if not exists public.kaleos_gifts (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid references public.kaleos_profiles(id) on delete set null, -- vacío = anónimo
  kind text not null check (kind in ('diezmo','ofrenda','donacion','proyecto')),
  dest text not null default 'General',
  fund_id bigint references public.kaleos_funds(id) on delete set null,
  method text not null check (method in ('transferencia','tarjeta','sobre','efectivo')),
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  receipt text,
  status text not null default 'pendiente' check (status in ('pendiente','confirmado')),
  gift_date date not null default (now() at time zone 'America/Guatemala')::date,
  created_by uuid default auth.uid(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists kaleos_gifts_church on public.kaleos_gifts (church_id, gift_date desc);
create index if not exists kaleos_gifts_profile on public.kaleos_gifts (profile_id);

create or replace function public.kaleos_gift_receipt() returns trigger
language plpgsql as $$
begin
  if new.receipt is null or trim(new.receipt) = '' then
    new.receipt := case when new.method = 'sobre' then 'S-' else 'R-' end || lpad(new.id::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists kaleos_gifts_receipt on public.kaleos_gifts;
create trigger kaleos_gifts_receipt before insert on public.kaleos_gifts
for each row execute function public.kaleos_gift_receipt();

alter table public.kaleos_gifts enable row level security;
drop policy if exists kaleos_gifts_read on public.kaleos_gifts;
create policy kaleos_gifts_read on public.kaleos_gifts for select to authenticated
  using (church_id = public.kaleos_my_church() and (profile_id = auth.uid() or public.kaleos_is_staff()));
drop policy if exists kaleos_gifts_member_insert on public.kaleos_gifts;
create policy kaleos_gifts_member_insert on public.kaleos_gifts for insert to authenticated
  with check (church_id = public.kaleos_my_church() and (
    (profile_id = auth.uid() and status = 'pendiente' and method in ('transferencia','sobre'))
    or public.kaleos_is_secretary()));
drop policy if exists kaleos_gifts_secretary on public.kaleos_gifts;
create policy kaleos_gifts_secretary on public.kaleos_gifts for update to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_secretary())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_secretary());
drop policy if exists kaleos_gifts_secretary_delete on public.kaleos_gifts;
create policy kaleos_gifts_secretary_delete on public.kaleos_gifts for delete to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_secretary());

-- Lo reunido por cada proyecto o necesidad (los hermanos ven el total, no quién dio)
create or replace function public.kaleos_fund_totals()
returns table (fund_id bigint, total numeric)
language sql stable security definer set search_path = public as $$
  select g.fund_id, sum(g.amount) from public.kaleos_gifts g
  where g.church_id = public.kaleos_my_church() and g.status = 'confirmado' and g.fund_id is not null
  group by g.fund_id
$$;

-- Proyectos y necesidades de ejemplo (se editan en la Central)
insert into public.kaleos_funds (church_id, kind, name, subtitle, goal, until_label, palette, style, emblem, sort)
select ch.id, v.kind, v.name, v.subtitle, v.goal, v.until_label, v.palette, v.style, v.emblem, v.sort
from public.kaleos_churches ch, (values
  ('proyecto', 'Techo del templo', 'Construcción', 85000, 'marzo 2027', 'cielo', 'cumbres', 'proyecto', 1),
  ('proyecto', 'Equipo misionero a Petén', 'Misiones', 12000, '20 de noviembre', 'ocaso', 'cumbres', 'c_misiones', 2),
  ('proyecto', 'Aniversario 45', 'Culto especial e invitados', 18000, 'enero 2027', 'oro', 'luz', 'felicitacion', 3),
  ('necesidad', 'Niños', 'Refacción del domingo y materiales', 1500, 'cada mes', 'cielo', 'luz', 'c_infantil', 4),
  ('necesidad', 'Ancianos', 'Transporte y almuerzo mensual', 1800, 'cada mes', 'lino', 'lienzo', 'c_plata', 5),
  ('necesidad', 'Becas', 'Jóvenes que estudian', 2400, 'cada mes', 'alba', 'cumbres', 'c_emergente', 6)
) as v(kind, name, subtitle, goal, until_label, palette, style, emblem, sort)
where ch.slug = 'la-linea'
  and not exists (select 1 from public.kaleos_funds f where f.church_id = ch.id);

-- ===== 10. Permisos =====
grant select, insert, update, delete on public.kaleos_communities, public.kaleos_community_members,
  public.kaleos_verses, public.kaleos_reminders, public.kaleos_logbook, public.kaleos_staff_notes,
  public.kaleos_services, public.kaleos_funds, public.kaleos_gifts to authenticated;
revoke execute on function public.kaleos_is_staff(), public.kaleos_is_secretary(), public.kaleos_my_level(),
  public.kaleos_in_community(bigint), public.kaleos_communities_overview(), public.kaleos_community_people(bigint),
  public.kaleos_fund_totals(), public.kaleos_attendance_weeks(int) from public, anon;
grant execute on function public.kaleos_is_staff(), public.kaleos_is_secretary(), public.kaleos_my_level(),
  public.kaleos_in_community(bigint), public.kaleos_communities_overview(), public.kaleos_community_people(bigint),
  public.kaleos_fund_totals(), public.kaleos_attendance_weeks(int) to authenticated;
revoke execute on function public.kaleos_guard_profile(), public.kaleos_gift_receipt() from public, anon, authenticated;

-- ===== 11. Cuenta de prueba: el ujier de ejemplo pasa a ser Secretario-Tesorero =====
update public.kaleos_profiles p set role = 'secretary'
from auth.users u
where u.id = p.id and p.member_no = 'LL-0002' and p.role = 'usher' and (u.raw_user_meta_data->>'demo') = 'true';
