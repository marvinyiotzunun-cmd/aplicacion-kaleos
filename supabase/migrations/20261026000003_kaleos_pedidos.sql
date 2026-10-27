-- Kaleos: Pedidos de los hermanos (felicitación, visita, oración u otro)
-- Se amplía la tabla de peticiones de oración para que guarde cualquier pedido.

alter table public.kaleos_prayer_requests
  add column if not exists kind text not null default 'oracion'
    check (kind in ('felicitacion','visita','oracion','otro')),
  add column if not exists for_name text,          -- si el pedido es para otra persona
  add column if not exists for_date date,          -- fecha de la felicitación o de la visita
  add column if not exists created_by uuid,           -- quién lo anotó (sin llave foránea: no rompe la versión publicada)
  add column if not exists done_at timestamptz;

create index if not exists kaleos_prayer_church_status on public.kaleos_prayer_requests (church_id, status);

-- El hermano pide para sí; el pastor también puede anotar pedidos de cualquier hermano de su iglesia
drop policy if exists kaleos_prayer_insert on public.kaleos_prayer_requests;
create policy kaleos_prayer_insert on public.kaleos_prayer_requests for insert to authenticated
  with check (church_id = public.kaleos_my_church() and (
    profile_id = auth.uid()
    or (public.kaleos_is_pastor() and exists (
      select 1 from public.kaleos_profiles p where p.id = profile_id and p.church_id = public.kaleos_my_church()))));

-- El reporte del mes sigue contando solo las peticiones de oración
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
        where church_id = v_church and kind = 'oracion' and created_at >= m0 and created_at < m1),
    'requests', (select count(*) from public.kaleos_prayer_requests
        where church_id = v_church and created_at >= m0 and created_at < m1),
    'members_total', (select count(*) from public.kaleos_profiles where church_id = v_church and active)
  );
end $$;

-- El hermano puede agregar el detalle a su pedido mientras sigue nuevo
drop policy if exists kaleos_prayer_own_update on public.kaleos_prayer_requests;
create policy kaleos_prayer_own_update on public.kaleos_prayer_requests for update to authenticated
  using (profile_id = auth.uid() and status = 'nueva')
  with check (profile_id = auth.uid() and status = 'nueva' and church_id = public.kaleos_my_church());
