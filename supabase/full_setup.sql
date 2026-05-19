-- Smart Exam Control SaaS - complete Supabase setup
-- Run this file once in Supabase SQL Editor for a fresh project.
-- Important: this supports school links by tenant slug. Strict RLS is in rls_policies.sql
-- and should be enabled after adding Supabase Auth or an Edge Function login flow.

create extension if not exists "pgcrypto";

drop table if exists public.envelope_openings cascade;
drop table if exists public.notifications cascade;
drop table if exists public.system_config cascade;
drop table if exists public.committee_reports cascade;
drop table if exists public.control_requests cascade;
drop table if exists public.delivery_logs cascade;
drop table if exists public.supervision cascade;
drop table if exists public.absences cascade;
drop table if exists public.students cascade;
drop table if exists public.users cascade;
drop table if exists public.tenants cascade;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'TRIAL'
    check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED')),
  plan text not null default 'starter',
  logo_url text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  national_id text not null,
  full_name text not null,
  role text not null default 'PROCTOR'
    check (role in ('ADMIN', 'CONTROL_MANAGER', 'PROCTOR', 'CONTROL', 'ASSISTANT_CONTROL', 'COUNSELOR')),
  phone text default '',
  assigned_committees text[] default '{}',
  assigned_grades text[] default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, national_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  national_id text not null,
  name text not null,
  grade text default '',
  section text default '',
  parent_phone text default '',
  committee_number text default '',
  seating_number text default '',
  location text default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, national_id)
);

create table public.supervision (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_id uuid not null,
  committee_number text not null,
  date text not null,
  period integer not null default 1,
  subject text default 'اختبار',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.absences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date text not null,
  student_id text not null,
  student_name text not null,
  committee_number text not null,
  period integer not null default 1,
  type text not null check (type in ('ABSENT', 'LATE')),
  proctor_id uuid not null,
  note text default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, student_id, date, period)
);

create table public.delivery_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  teacher_name text not null,
  proctor_name text default '',
  committee_number text not null,
  grade text default '',
  type text not null check (type in ('ISSUE', 'RECEIVE')),
  time text not null,
  period integer not null default 1,
  status text default 'PENDING' check (status in ('CONFIRMED', 'PENDING')),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.control_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  from_user_name text not null,
  committee_number text not null,
  text text not null,
  time text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED')),
  assistant_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.committee_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  committee_number text not null,
  proctor_id uuid not null,
  proctor_name text not null,
  date text not null,
  observations text default '',
  issues text default '',
  resolutions text default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.system_config (
  id text not null default 'main_config',
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exam_start_time text default '08:00',
  exam_date text default '',
  active_exam_date text default current_date::text,
  allow_manual_join boolean default false,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (tenant_id, id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  message text not null,
  target text not null default 'ALL',
  sender text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.envelope_openings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date text not null,
  time text not null,
  subject text not null,
  grade text not null,
  status text not null default 'INTACT' check (status in ('INTACT', 'DAMAGED')),
  opened_by text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index supervision_tenant_date_idx on public.supervision(tenant_id, date);
create index absences_tenant_date_idx on public.absences(tenant_id, date);
create index delivery_logs_tenant_time_idx on public.delivery_logs(tenant_id, time);
create index control_requests_tenant_time_idx on public.control_requests(tenant_id, time);
create index committee_reports_tenant_date_idx on public.committee_reports(tenant_id, date);
create index envelope_openings_tenant_date_idx on public.envelope_openings(tenant_id, date);

-- Demo school. Change slug to the code you want in the school link.
insert into public.tenants (id, name, slug, status, plan)
values ('00000000-0000-0000-0000-000000000001', 'مدرسة تجريبية', 'demo-school', 'ACTIVE', 'starter');

insert into public.system_config (tenant_id, id, exam_start_time, active_exam_date, allow_manual_join)
values ('00000000-0000-0000-0000-000000000001', 'main_config', '08:00', current_date::text, false);

-- Demo admin login:
-- school link: http://localhost:3000/?tenant=demo-school
-- national id: 1111111111
insert into public.users (tenant_id, national_id, full_name, role, phone)
values ('00000000-0000-0000-0000-000000000001', '1111111111', 'مدير المدرسة التجريبية', 'ADMIN', '0500000000');

-- Helpful sample students and proctor.
insert into public.users (tenant_id, national_id, full_name, role, phone)
values ('00000000-0000-0000-0000-000000000001', '2222222222', 'معلم تجريبي', 'PROCTOR', '0500000001');

insert into public.students (tenant_id, national_id, name, grade, section, committee_number, seating_number, parent_phone)
values
  ('00000000-0000-0000-0000-000000000001', '3333333333', 'طالب تجريبي 1', 'الأول متوسط', '1', '1', '101', '0501111111'),
  ('00000000-0000-0000-0000-000000000001', '4444444444', 'طالب تجريبي 2', 'الأول متوسط', '1', '1', '102', '0502222222');

-- For production isolation, implement Auth/Edge login then run supabase/rls_policies.sql.
