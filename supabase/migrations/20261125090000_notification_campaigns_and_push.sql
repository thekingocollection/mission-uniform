-- Mission Uniform OP: in-app + web-push notification campaigns
create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_type text not null default 'all' check (target_type in ('all','active_7d','inactive_2d','new_7d')),
  target_days integer not null default 2 check (target_days between 1 and 365),
  target_url text not null default '/notifications',
  inapp_enabled boolean not null default true,
  push_enabled boolean not null default true,
  schedule_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('draft','scheduled','sending','sent','failed')),
  target_count integer not null default 0,
  inapp_count integer not null default 0,
  push_sent_count integer not null default 0,
  push_failed_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text
);
create index if not exists notification_campaigns_due_idx
  on public.notification_campaigns(status, schedule_at);

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.notification_campaigns(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  target_url text not null default '/notifications',
  inapp_visible boolean not null default true,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  clicked_at timestamptz,
  push_status text not null default 'not_requested' check (push_status in ('not_requested','pending','sent','failed','no_subscription')),
  push_sent_at timestamptz,
  push_error text
);
create index if not exists student_notifications_user_created_idx
  on public.student_notifications(user_id, created_at desc);
create index if not exists student_notifications_campaign_idx
  on public.student_notifications(campaign_id);

create table if not exists public.student_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_push_subscriptions_user_idx
  on public.student_push_subscriptions(user_id);

alter table public.notification_campaigns enable row level security;
alter table public.student_notifications enable row level security;
alter table public.student_push_subscriptions enable row level security;
-- Access is intentionally routed through authenticated Next.js APIs using the
-- Supabase service role. No direct client policies are created for these tables.
