-- MISSION UNIFORM OP: repair job_alerts columns used by the admin UI.
-- Safe to run more than once. Existing job-alert rows are preserved.
begin;

create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  organization text,
  description text,
  official_url text,
  last_date date,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.job_alerts add column if not exists title text not null default '';
alter table public.job_alerts add column if not exists organization text;
alter table public.job_alerts add column if not exists description text;
alter table public.job_alerts add column if not exists official_url text;
alter table public.job_alerts add column if not exists last_date date;
alter table public.job_alerts add column if not exists published boolean not null default false;
alter table public.job_alerts add column if not exists created_at timestamptz not null default now();

alter table public.job_alerts enable row level security;

drop policy if exists jobs_public_read on public.job_alerts;
drop policy if exists jobs_super_all on public.job_alerts;
drop policy if exists "published jobs visible" on public.job_alerts;
drop policy if exists "admin manage jobs" on public.job_alerts;

create policy jobs_public_read
on public.job_alerts for select to anon, authenticated
using (published = true or public.is_super_admin());

create policy jobs_super_all
on public.job_alerts for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

grant select on public.job_alerts to anon, authenticated;
grant insert, update, delete on public.job_alerts to authenticated;

notify pgrst, 'reload schema';

commit;
