create extension if not exists pgcrypto;

create table if not exists public.exam_envelopes (
  id uuid primary key default gen_random_uuid(),
  exam_date date not null,
  period integer not null default 1,
  subject text not null,
  grade text not null,
  subject_teacher_id text not null,
  subject_teacher_name text not null,
  status text not null default 'READY'
    check (status in ('READY', 'OPENED', 'CANCELLED')),
  opened_by text,
  opened_at timestamptz,
  opening_id uuid,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exam_envelopes_unique_active_idx
on public.exam_envelopes (
  exam_date,
  period,
  subject,
  grade,
  subject_teacher_id
)
where status <> 'CANCELLED';

alter table public.exam_envelopes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'exam_envelopes'
  ) then
    alter publication supabase_realtime add table public.exam_envelopes;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'envelope_openings'
  ) then
    alter publication supabase_realtime add table public.envelope_openings;
  end if;
end $$;
