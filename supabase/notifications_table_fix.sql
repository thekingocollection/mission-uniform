-- MISSION UNIFORM OP: restore the admin notifications table safely.
-- Idempotent: preserves existing rows and adds only missing columns.
begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications add column if not exists title text not null default '';
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists published boolean not null default false;
alter table public.notifications add column if not exists created_at timestamptz not null default now();

alter table public.notifications enable row level security;

drop policy if exists notifications_public_read on public.notifications;
drop policy if exists notifications_super_all on public.notifications;
drop policy if exists "published notifications visible" on public.notifications;
drop policy if exists "admin manage notifications" on public.notifications;

create policy notifications_public_read
on public.notifications for select to anon, authenticated
using (published = true or public.is_super_admin());

create policy notifications_super_all
on public.notifications for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select on public.notifications to anon, authenticated;
grant insert, update, delete on public.notifications to authenticated;

-- Ask Supabase Data API (PostgREST) to refresh its table metadata.
notify pgrst, 'reload schema';

commit;
