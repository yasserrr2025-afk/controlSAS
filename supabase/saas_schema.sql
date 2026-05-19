-- SaaS foundation for Smart Exam Control.
-- Run in Supabase SQL Editor on a fresh project, or adapt the ALTER parts for an existing one.

create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'TRIAL'
    check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED')),
  plan text not null default 'starter',
  logo_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;

create or replace function public.add_tenant_column(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('alter table public.%I add column if not exists tenant_id uuid references public.tenants(id) on delete cascade', table_name);
end;
$$;

select public.add_tenant_column('users');
select public.add_tenant_column('students');
select public.add_tenant_column('supervision');
select public.add_tenant_column('absences');
select public.add_tenant_column('delivery_logs');
select public.add_tenant_column('control_requests');
select public.add_tenant_column('committee_reports');
select public.add_tenant_column('system_config');
select public.add_tenant_column('notifications');
select public.add_tenant_column('envelope_openings');

drop function public.add_tenant_column(text);

alter table public.users add column if not exists assigned_committees text[] default '{}';
alter table public.users add column if not exists assigned_grades text[] default '{}';
alter table public.students add column if not exists seating_number text;
alter table public.students add column if not exists location text;
alter table public.delivery_logs add column if not exists proctor_name text;
alter table public.delivery_logs add column if not exists status text default 'PENDING';
alter table public.control_requests add column if not exists assistant_name text;
alter table public.system_config add column if not exists active_exam_date text default current_date::text;
alter table public.system_config add column if not exists allow_manual_join boolean default false;

create unique index if not exists users_tenant_national_id_uidx
  on public.users(tenant_id, national_id);

create unique index if not exists students_tenant_national_id_uidx
  on public.students(tenant_id, national_id);

create unique index if not exists system_config_tenant_id_uidx
  on public.system_config(tenant_id, id);

create unique index if not exists absences_tenant_student_day_period_uidx
  on public.absences(tenant_id, student_id, date, period);

create index if not exists supervision_tenant_date_idx on public.supervision(tenant_id, date);
create index if not exists delivery_logs_tenant_time_idx on public.delivery_logs(tenant_id, time);
create index if not exists control_requests_tenant_time_idx on public.control_requests(tenant_id, time);
create index if not exists committee_reports_tenant_date_idx on public.committee_reports(tenant_id, date);
create index if not exists envelope_openings_tenant_date_idx on public.envelope_openings(tenant_id, date);

-- Seed one demo tenant. Change this before production.
insert into public.tenants (name, slug, status, plan)
values ('Demo School', 'demo-school', 'ACTIVE', 'starter')
on conflict (slug) do nothing;

-- Production RLS policies are in supabase/rls_policies.sql.
-- Do not enable them until Supabase Auth or a backend JWT flow sends tenant_id in auth.jwt().
