-- SaaS upgrade for features imported from newcontrol.
-- Run manually in Supabase SQL Editor after reviewing against your existing schema.
-- This file is not executed by the app.

create extension if not exists "pgcrypto";

create table if not exists public.exam_schedule (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  exam_date text not null,
  day_name text,
  subject text not null,
  period integer not null default 1,
  start_time text not null default '08:00',
  end_time text,
  grades text[] default '{}',
  committees text[] default '{}',
  notes text,
  status text default 'READY',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.archive_boxes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  box_number text not null,
  grade text not null default '',
  subject text not null default '',
  exam_date text not null default current_date::text,
  committees text[] default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.system_config add column if not exists academic_year text default '1446 / 1447';
alter table public.system_config add column if not exists openrouter_api_key text;

create index if not exists exam_schedule_tenant_date_idx
  on public.exam_schedule(tenant_id, exam_date, period);

create index if not exists archive_boxes_tenant_date_idx
  on public.archive_boxes(tenant_id, exam_date);

alter table public.exam_schedule enable row level security;
alter table public.archive_boxes enable row level security;

drop policy if exists "tenant isolated exam schedule" on public.exam_schedule;
create policy "tenant isolated exam schedule"
on public.exam_schedule for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

drop policy if exists "tenant isolated archive boxes" on public.archive_boxes;
create policy "tenant isolated archive boxes"
on public.archive_boxes for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.exam_schedule to authenticated;
grant select, insert, update, delete on public.archive_boxes to authenticated;
