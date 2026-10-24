-- Kaleos: esquema inicial (tablas con prefijo kaleos_ para convivir en un proyecto compartido)

create table if not exists public.kaleos_churches (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  short_name text,
  mission text,
  pastor_phone text,
  supervisor_name text default 'Supervisor de Distrito',
  supervisor_email text,
  member_prefix text not null default 'LL',
  created_at timestamptz not null default now()
);

create table if not exists public.kaleos_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  member_no text not null,
  full_name text not null,
  title text default 'Hno.',
  role text not null default 'member' check (role in ('member','usher','pastor')),
  stage text not null default 'visitante'
    check (stage in ('visitante','miembro','bautizado','grupo','sirviendo','lider')),
  phone text,
  birthday date,
  member_since date,
  baptism_date date,
  serves_in text,
  qr_token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (church_id, member_no)
);

create table if not exists public.kaleos_steps (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  step text not null check (step in ('visitante','miembro','bautizado','grupo','sirviendo','lider')),
  achieved_on date not null default current_date,
  unique (profile_id, step)
);

create table if not exists public.kaleos_attendance (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  service_date date not null default (now() at time zone 'America/Guatemala')::date,
  scanned_at timestamptz not null default now(),
  scanned_by uuid references public.kaleos_profiles(id) on delete set null,
  unique (profile_id, service_date)
);

create table if not exists public.kaleos_prayer_requests (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  note text,
  status text not null default 'nueva' check (status in ('nueva','orando','atendida')),
  created_at timestamptz not null default now()
);

create table if not exists public.kaleos_notices (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  title text not null default 'Aviso de la semana',
  body text not null,
  sermon_title text,
  sermon_url text,
  created_by uuid references public.kaleos_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.kaleos_visits (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  profile_id uuid not null references public.kaleos_profiles(id) on delete cascade,
  pastor_id uuid references public.kaleos_profiles(id) on delete set null,
  visited_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.kaleos_reports (
  id bigint generated always as identity primary key,
  church_id uuid not null references public.kaleos_churches(id) on delete cascade,
  month date not null,
  data jsonb not null,
  sent_at timestamptz,
  sent_by uuid references public.kaleos_profiles(id) on delete set null,
  unique (church_id, month)
);

create index if not exists kaleos_attendance_church_date on public.kaleos_attendance (church_id, service_date);
create index if not exists kaleos_profiles_church on public.kaleos_profiles (church_id);
create index if not exists kaleos_prayer_church on public.kaleos_prayer_requests (church_id, created_at desc);
create index if not exists kaleos_visits_church on public.kaleos_visits (church_id, visited_on);
create index if not exists kaleos_notices_church on public.kaleos_notices (church_id, created_at desc);

-- ===== Funciones de apoyo (security definer para evitar recursión en RLS) =====

create or replace function public.kaleos_my_church() returns uuid
language sql stable security definer set search_path = public as $$
  select church_id from public.kaleos_profiles where id = auth.uid() and active
$$;

create or replace function public.kaleos_my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.kaleos_profiles where id = auth.uid() and active
$$;

create or replace function public.kaleos_is_pastor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.kaleos_my_role() = 'pastor', false)
$$;

-- Registrar asistencia por QR (ujier o pastor)
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
  if v_role is null or v_role not in ('usher','pastor') then
    raise exception 'Solo el ujier o el pastor pueden registrar asistencia';
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
    exit when not exists (
      select 1 from public.kaleos_attendance
      where profile_id = v_p.id and service_date = d);
    v_streak := v_streak + 1;
    d := d - 7;
  end loop;
  return json_build_object('ok', true, 'new', v_new, 'name', v_p.full_name,
    'title', v_p.title, 'member_no', v_p.member_no, 'streak', v_streak);
end $$;

-- Domingos seguidos del usuario actual
create or replace function public.kaleos_my_streak() returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Guatemala')::date;
  d date := v_today - ((extract(dow from v_today))::int);
  n int := 0;
begin
  if not exists (select 1 from public.kaleos_attendance where profile_id = auth.uid() and service_date = d) then
    d := d - 7; -- el domingo de esta semana aún puede no haber llegado
  end if;
  loop
    exit when not exists (select 1 from public.kaleos_attendance where profile_id = auth.uid() and service_date = d);
    n := n + 1; d := d - 7;
  end loop;
  return n;
end $$;

-- Panel del pastor: Cuidar y Formar
create or replace function public.kaleos_pastor_panel()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_church uuid := public.kaleos_my_church();
  v_today date := (now() at time zone 'America/Guatemala')::date;
begin
  if not public.kaleos_is_pastor() then raise exception 'Solo el pastor'; end if;
  return json_build_object(
    'birthdays', (select coalesce(json_agg(json_build_object('id', id, 'name', full_name, 'title', title, 'phone', phone, 'birthday', birthday) order by full_name), '[]')
      from public.kaleos_profiles
      where church_id = v_church and active and birthday is not null
        and exists (select 1 from generate_series(0, 7) g
                    where to_char(birthday, 'MM-DD') = to_char(v_today + g, 'MM-DD'))),
    'absent', (select coalesce(json_agg(x order by x->>'last' nulls first), '[]') from (
      select json_build_object('id', p.id, 'name', p.full_name, 'title', p.title, 'phone', p.phone,
        'last', (select max(service_date) from public.kaleos_attendance a where a.profile_id = p.id)) x
      from public.kaleos_profiles p
      where p.church_id = v_church and p.active and p.role <> 'pastor'
        and exists (select 1 from public.kaleos_attendance a where a.profile_id = p.id)
        and (select max(service_date) from public.kaleos_attendance a where a.profile_id = p.id) < v_today - 20
    ) s),
    'prayers_new', (select count(*) from public.kaleos_prayer_requests where church_id = v_church and status = 'nueva'),
    'ready_baptism', (select coalesce(json_agg(json_build_object('id', id, 'name', full_name)), '[]')
      from public.kaleos_profiles where church_id = v_church and active and stage = 'miembro' and baptism_date is null),
    'ready_lead', (select coalesce(json_agg(json_build_object('id', id, 'name', full_name)), '[]')
      from public.kaleos_profiles where church_id = v_church and active and stage = 'sirviendo'),
    'visitors_no_follow', (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone)), '[]')
      from public.kaleos_profiles p where p.church_id = v_church and p.active and p.stage = 'visitante'
        and not exists (select 1 from public.kaleos_visits v where v.profile_id = p.id and v.visited_on > v_today - 30)),
    'members_total', (select count(*) from public.kaleos_profiles where church_id = v_church and active)
  );
end $$;

-- Reporte ministerial del mes (se arma con lo registrado)
create or replace function public.kaleos_month_report(p_month date)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_church uuid := public.kaleos_my_church();
  m0 date := date_trunc('month', p_month)::date;
  m1 date := (date_trunc('month', p_month) + interval '1 month')::date;
begin
  if not public.kaleos_is_pastor() then raise exception 'Solo el pastor'; end if;
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
        where church_id = v_church and created_at >= m0 and created_at < m1),
    'members_total', (select count(*) from public.kaleos_profiles where church_id = v_church and active)
  );
end $$;

-- Al cambiar de etapa, sellar el paso en el camino
create or replace function public.kaleos_stamp_step() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  steps text[] := array['visitante','miembro','bautizado','grupo','sirviendo','lider'];
  i int;
begin
  for i in 1 .. array_position(steps, new.stage) loop
    insert into public.kaleos_steps (profile_id, step, achieved_on)
    values (new.id, steps[i], case when steps[i] = 'bautizado' and new.baptism_date is not null then new.baptism_date
                                   when steps[i] = 'miembro' and new.member_since is not null then new.member_since
                                   else current_date end)
    on conflict (profile_id, step) do nothing;
  end loop;
  return new;
end $$;

create trigger kaleos_profiles_stamp after insert or update of stage on public.kaleos_profiles
for each row execute function public.kaleos_stamp_step();

-- ===== RLS =====
alter table public.kaleos_churches enable row level security;
alter table public.kaleos_profiles enable row level security;
alter table public.kaleos_steps enable row level security;
alter table public.kaleos_attendance enable row level security;
alter table public.kaleos_prayer_requests enable row level security;
alter table public.kaleos_notices enable row level security;
alter table public.kaleos_visits enable row level security;
alter table public.kaleos_reports enable row level security;

create policy kaleos_churches_read on public.kaleos_churches for select to authenticated
  using (id = public.kaleos_my_church());
create policy kaleos_churches_pastor_update on public.kaleos_churches for update to authenticated
  using (id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (id = public.kaleos_my_church());

create policy kaleos_profiles_read on public.kaleos_profiles for select to authenticated
  using (id = auth.uid() or (church_id = public.kaleos_my_church() and public.kaleos_is_pastor()));
create policy kaleos_profiles_pastor_update on public.kaleos_profiles for update to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church());

create policy kaleos_steps_read on public.kaleos_steps for select to authenticated
  using (profile_id = auth.uid() or (public.kaleos_is_pastor() and exists (
    select 1 from public.kaleos_profiles p where p.id = profile_id and p.church_id = public.kaleos_my_church())));
create policy kaleos_steps_pastor_write on public.kaleos_steps for all to authenticated
  using (public.kaleos_is_pastor() and exists (
    select 1 from public.kaleos_profiles p where p.id = profile_id and p.church_id = public.kaleos_my_church()))
  with check (public.kaleos_is_pastor() and exists (
    select 1 from public.kaleos_profiles p where p.id = profile_id and p.church_id = public.kaleos_my_church()));

create policy kaleos_attendance_read on public.kaleos_attendance for select to authenticated
  using (profile_id = auth.uid() or (church_id = public.kaleos_my_church() and public.kaleos_my_role() in ('pastor','usher')));

create policy kaleos_prayer_insert on public.kaleos_prayer_requests for insert to authenticated
  with check (profile_id = auth.uid() and church_id = public.kaleos_my_church());
create policy kaleos_prayer_read on public.kaleos_prayer_requests for select to authenticated
  using (profile_id = auth.uid() or (church_id = public.kaleos_my_church() and public.kaleos_is_pastor()));
create policy kaleos_prayer_pastor_update on public.kaleos_prayer_requests for update to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church());

create policy kaleos_notices_read on public.kaleos_notices for select to authenticated
  using (church_id = public.kaleos_my_church());
create policy kaleos_notices_pastor_write on public.kaleos_notices for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

create policy kaleos_visits_pastor on public.kaleos_visits for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

create policy kaleos_reports_pastor on public.kaleos_reports for all to authenticated
  using (church_id = public.kaleos_my_church() and public.kaleos_is_pastor())
  with check (church_id = public.kaleos_my_church() and public.kaleos_is_pastor());

-- Funciones: solo usuarios autenticados
revoke execute on function public.kaleos_check_in(text), public.kaleos_my_streak(),
  public.kaleos_pastor_panel(), public.kaleos_month_report(date),
  public.kaleos_my_church(), public.kaleos_my_role(), public.kaleos_is_pastor() from public, anon;
grant execute on function public.kaleos_check_in(text), public.kaleos_my_streak(),
  public.kaleos_pastor_panel(), public.kaleos_month_report(date),
  public.kaleos_my_church(), public.kaleos_my_role(), public.kaleos_is_pastor() to authenticated;
revoke execute on function public.kaleos_stamp_step() from public, anon, authenticated;

-- Iglesia inicial
insert into public.kaleos_churches (slug, name, short_name, mission, member_prefix)
values ('la-linea', 'Iglesia de Dios Evangelio Completo de La Línea', 'La Línea',
  'Hacer discípulos que amen a Dios, sirvan a su iglesia y alcancen a La Línea.', 'LL')
on conflict (slug) do nothing;
