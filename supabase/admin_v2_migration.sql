-- MISSION UNIFORM OP V2: Super Admin only security migration
-- Designed to preserve the user's live questions/attempts column names.
-- Run after backing up the project database.

begin;

-- Ensure the profile table has the expected role and student-control fields.
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- Restrict role values to student/super_admin only. Existing staff/admin roles are demoted
-- so the selected access model remains Only Super Admin.
update public.profiles set role = 'student' where role not in ('student','super_admin');
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student','super_admin'));

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin' and coalesce(p.is_blocked,false) = false); $$;
revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- Prevent users from promoting themselves or changing their blocked/role flags.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    new.role := old.role;
    new.is_blocked := old.is_blocked;
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists protect_profile_privileges_trigger on public.profiles;
create trigger protect_profile_privileges_trigger before update on public.profiles
for each row execute function public.protect_profile_privileges();

-- Replace broad/legacy policies with super-admin-only write policies.
do $$
declare t text; pol record;
begin
  foreach t in array array['profiles','subjects','chapters','questions','tests','attempts','job_alerts','notifications','site_settings'] loop
    for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
  end loop;
end $$;

-- Profiles: students can read/update only their own basic profile; only super admin can list/manage all.
create policy profiles_select_own_or_super on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin());
create policy profiles_update_own_basic on public.profiles for update to authenticated
using (id = auth.uid() or public.is_super_admin())
with check (id = auth.uid() or public.is_super_admin());
create policy profiles_insert_super_only on public.profiles for insert to authenticated
with check (public.is_super_admin());
create policy profiles_delete_super_only on public.profiles for delete to authenticated
using (public.is_super_admin());
revoke update on public.profiles from authenticated;
grant update (full_name, phone, is_blocked) on public.profiles to authenticated;
grant select, insert, delete on public.profiles to authenticated;

-- Public read of published learning content; only super admin writes.
revoke all on public.questions from anon;
grant select, insert, update, delete on public.questions to authenticated;
create policy subjects_public_read on public.subjects for select to anon, authenticated using (published = true or public.is_super_admin());
create policy subjects_super_all on public.subjects for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy chapters_public_read on public.chapters for select to anon, authenticated using (published = true or public.is_super_admin());
create policy chapters_super_all on public.chapters for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy questions_public_read on public.questions for select to authenticated using (is_active = true or public.is_super_admin());
create policy questions_super_all on public.questions for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy tests_public_read on public.tests for select to anon, authenticated using (published = true or public.is_super_admin());
create policy tests_super_all on public.tests for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Students see only their own attempts; admin can inspect all.
create policy attempts_select_own_or_super on public.attempts for select to authenticated
using (user_id = auth.uid() or public.is_super_admin());
create policy attempts_insert_own on public.attempts for insert to authenticated
with check (user_id = auth.uid());
create policy attempts_super_update_delete on public.attempts for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy jobs_public_read on public.job_alerts for select to anon, authenticated using (published = true or public.is_super_admin());
create policy jobs_super_all on public.job_alerts for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy notifications_public_read on public.notifications for select to anon, authenticated using (published = true or public.is_super_admin());
create policy notifications_super_all on public.notifications for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy settings_public_read on public.site_settings for select to anon, authenticated using (true);
create policy settings_super_all on public.site_settings for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Admin audit trail. No student access.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_logs enable row level security;
drop policy if exists admin_audit_super_read on public.admin_audit_logs;
drop policy if exists admin_audit_super_insert on public.admin_audit_logs;
create policy admin_audit_super_read on public.admin_audit_logs for select to authenticated using (public.is_super_admin());
create policy admin_audit_super_insert on public.admin_audit_logs for insert to authenticated with check (public.is_super_admin() and admin_id = auth.uid());
grant select, insert on public.admin_audit_logs to authenticated;

commit;

-- IMPORTANT: After running this migration, assign your own account as Super Admin
-- using the separate one-time SQL in ADMIN_V2_SETUP.md. Never expose the service-role key.
