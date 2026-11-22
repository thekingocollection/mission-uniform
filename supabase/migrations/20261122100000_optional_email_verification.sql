alter table public.profiles
  add column if not exists email_verified boolean not null default false;

create table if not exists public.email_verification_tokens (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_verification_tokens enable row level security;
revoke all on public.email_verification_tokens from anon, authenticated;
grant all on public.email_verification_tokens to service_role;

-- Email verification is informational only. It must never gate student learning access.
