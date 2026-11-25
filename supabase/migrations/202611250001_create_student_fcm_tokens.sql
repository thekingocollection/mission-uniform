-- Store one Firebase Cloud Messaging token per student/browser installation.
create table if not exists public.student_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_fcm_tokens_user_id_idx
  on public.student_fcm_tokens(user_id);

alter table public.student_fcm_tokens enable row level security;

-- No client policies are added. Reads/writes are performed by authenticated
-- server routes using the Supabase service-role client.
