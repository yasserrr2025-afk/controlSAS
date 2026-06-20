create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  target text not null default 'ALL',
  sender text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  user_role text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_user_role on public.push_subscriptions(user_role);

alter publication supabase_realtime add table public.notifications;
