-- Live student presence for the MISSION UNIFORM admin command centre.
begin;
create table if not exists public.student_live_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  current_path text not null default '/',
  active_attempt_id uuid,
  updated_at timestamptz not null default now()
);
create index if not exists student_live_presence_last_seen_idx
  on public.student_live_presence(last_seen_at desc);
create index if not exists student_live_presence_active_attempt_idx
  on public.student_live_presence(active_attempt_id) where active_attempt_id is not null;
alter table public.student_live_presence enable row level security;
revoke all on public.student_live_presence from anon, authenticated;
grant all on public.student_live_presence to service_role;
commit;
