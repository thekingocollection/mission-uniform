create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', phone text, role text not null default 'student' check (role in ('student','staff_admin','super_admin')),
 created_at timestamptz not null default now()
);
create table if not exists public.subjects (
 id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, name_od text, description text, sort_order int default 0, published boolean default true, created_at timestamptz default now()
);
create table if not exists public.chapters (
 id uuid primary key default gen_random_uuid(), subject_id uuid references public.subjects(id) on delete cascade,
 title text not null, content text default '', sort_order int default 0, published boolean default true, created_at timestamptz default now()
);
create table if not exists public.questions (
 id uuid primary key default gen_random_uuid(), subject_id uuid references public.subjects(id) on delete set null,
 chapter_id uuid references public.chapters(id) on delete set null, question text not null, question_od text,
 options jsonb not null check(jsonb_typeof(options)='array'), correct_index int not null check(correct_index between 0 and 9),
 explanation text default '', difficulty text default 'medium', published boolean default false, created_at timestamptz default now()
);
create table if not exists public.tests (
 id uuid primary key default gen_random_uuid(), title text not null, test_type text not null default 'daily',
 subject_id uuid references public.subjects(id) on delete set null, duration_minutes int not null default 20,
 question_ids uuid[] not null default '{}', published boolean default false, starts_at timestamptz, created_at timestamptz default now()
);
create table if not exists public.attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 test_id uuid references public.tests(id) on delete set null, title text not null, score int not null default 0,
 total int not null default 0, answers jsonb not null default '{}', submitted_at timestamptz not null default now()
);
create table if not exists public.job_alerts (
 id uuid primary key default gen_random_uuid(), title text not null, organization text, description text,
 official_url text, last_date date, published boolean default false, created_at timestamptz default now()
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(), title text not null, body text, published boolean default false, created_at timestamptz default now()
);
create table if not exists public.site_settings (
 key text primary key, value jsonb not null default '{}', updated_at timestamptz default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.phone) on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('super_admin','staff_admin'));
$$;
alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.questions enable row level security;
alter table public.tests enable row level security;
alter table public.attempts enable row level security;
alter table public.job_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.site_settings enable row level security;
drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select using(id=auth.uid() or public.is_admin());
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "published subjects visible" on public.subjects for select using(published or public.is_admin());
create policy "admin manage subjects" on public.subjects for all using(public.is_admin()) with check(public.is_admin());
create policy "published chapters visible" on public.chapters for select using(published or public.is_admin());
create policy "admin manage chapters" on public.chapters for all using(public.is_admin()) with check(public.is_admin());
create policy "published questions visible" on public.questions for select using(published or public.is_admin());
create policy "admin manage questions" on public.questions for all using(public.is_admin()) with check(public.is_admin());
create policy "published tests visible" on public.tests for select using(published or public.is_admin());
create policy "admin manage tests" on public.tests for all using(public.is_admin()) with check(public.is_admin());
create policy "attempts own read" on public.attempts for select using(user_id=auth.uid() or public.is_admin());
create policy "attempts own insert" on public.attempts for insert with check(user_id=auth.uid());
create policy "published jobs visible" on public.job_alerts for select using(published or public.is_admin());
create policy "admin manage jobs" on public.job_alerts for all using(public.is_admin()) with check(public.is_admin());
create policy "published notifications visible" on public.notifications for select using(published or public.is_admin());
create policy "admin manage notifications" on public.notifications for all using(public.is_admin()) with check(public.is_admin());
create policy "public settings read" on public.site_settings for select using(true);
create policy "admin settings write" on public.site_settings for all using(public.is_admin()) with check(public.is_admin());
-- Safe public question view: never expose correct_index to the student browser.
create or replace view public.public_questions with (security_invoker=true) as
 select id, subject_id, chapter_id, question, question_od, options, difficulty, created_at
 from public.questions where published=true;
revoke all on public.questions from anon, authenticated;
grant select on public.public_questions to anon, authenticated;
\n-- Email/password profiles and permission-aware staff security.\nalter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;
update public.profiles p set email=u.email from auth.users u where u.id=p.id and (p.email is null or p.email='');
create unique index if not exists profiles_email_lower_idx on public.profiles(lower(email)) where email is not null;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name,phone,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.raw_user_meta_data->>'phone',new.phone),new.email) on conflict(id) do update set email=excluded.email,full_name=case when public.profiles.full_name='' then excluded.full_name else public.profiles.full_name end,phone=coalesce(public.profiles.phone,excluded.phone);return new;end;$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('super_admin','staff_admin') and not p.is_blocked);$$;
create or replace function public.has_admin_permission(permission_name text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and not p.is_blocked and (p.role='super_admin' or (p.role='staff_admin' and coalesce((p.permissions->>permission_name)::boolean,false))));$$;
create or replace function public.guard_profile_privileges() returns trigger language plpgsql security definer set search_path=public as $$ begin if auth.uid() is not null and not public.has_admin_permission('manage_staff') then if new.role is distinct from old.role or new.permissions is distinct from old.permissions or new.is_blocked is distinct from old.is_blocked then raise exception 'Only Super Admin can change account roles, permissions or block status.';end if;end if;return new;end;$$;
drop trigger if exists guard_profile_privileges_trigger on public.profiles;create trigger guard_profile_privileges_trigger before update on public.profiles for each row execute function public.guard_profile_privileges();
create or replace function public.set_staff_access(p_email text,p_permissions jsonb,p_enabled boolean default true) returns void language plpgsql security definer set search_path=public,auth as $$
declare target_id uuid;begin if not exists(select 1 from public.profiles where id=auth.uid() and role='super_admin' and not is_blocked) then raise exception 'Only Super Admin can manage staff access.';end if;select id into target_id from auth.users where lower(email)=lower(trim(p_email)) limit 1;if target_id is null then raise exception 'No registered account found for this email. Ask the staff member to register first.';end if;if target_id=auth.uid() then raise exception 'You cannot change your own Super Admin access.';end if;if p_enabled then update public.profiles set role='staff_admin',permissions=coalesce(p_permissions,'{}'::jsonb),is_blocked=false where id=target_id;else update public.profiles set role='student',permissions='{}'::jsonb where id=target_id and role='staff_admin';end if;end;$$;
revoke all on function public.set_staff_access(text,jsonb,boolean) from public,anon;grant execute on function public.set_staff_access(text,jsonb,boolean) to authenticated;
drop policy if exists "profile read own or admin" on public.profiles;create policy "profile read own or authorized admin" on public.profiles for select using(id=auth.uid() or public.has_admin_permission('manage_students') or public.has_admin_permission('manage_staff'));
drop policy if exists "profile update own" on public.profiles;create policy "profile update own" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "published subjects visible" on public.subjects;drop policy if exists "admin manage subjects" on public.subjects;create policy "published subjects or authorized manager" on public.subjects for select using(published or public.has_admin_permission('manage_subjects'));create policy "authorized manage subjects" on public.subjects for all using(public.has_admin_permission('manage_subjects')) with check(public.has_admin_permission('manage_subjects'));
drop policy if exists "published chapters visible" on public.chapters;drop policy if exists "admin manage chapters" on public.chapters;create policy "published chapters or authorized manager" on public.chapters for select using(published or public.has_admin_permission('manage_subjects'));create policy "authorized manage chapters" on public.chapters for all using(public.has_admin_permission('manage_subjects')) with check(public.has_admin_permission('manage_subjects'));
drop policy if exists "published questions visible" on public.questions;drop policy if exists "admin manage questions" on public.questions;create policy "published questions or authorized manager" on public.questions for select using(published or public.has_admin_permission('manage_questions'));create policy "authorized manage questions" on public.questions for all using(public.has_admin_permission('manage_questions')) with check(public.has_admin_permission('manage_questions'));
drop policy if exists "published tests visible" on public.tests;drop policy if exists "admin manage tests" on public.tests;create policy "published tests or authorized manager" on public.tests for select using(published or public.has_admin_permission('manage_tests'));create policy "authorized manage tests" on public.tests for all using(public.has_admin_permission('manage_tests')) with check(public.has_admin_permission('manage_tests'));
drop policy if exists "attempts own read" on public.attempts;create policy "attempts own or authorized read" on public.attempts for select using(user_id=auth.uid() or public.has_admin_permission('manage_students'));drop policy if exists "attempts own insert" on public.attempts;create policy "attempts own insert" on public.attempts for insert with check(user_id=auth.uid());
drop policy if exists "published jobs visible" on public.job_alerts;drop policy if exists "admin manage jobs" on public.job_alerts;create policy "published jobs or authorized manager" on public.job_alerts for select using(published or public.has_admin_permission('manage_jobs'));create policy "authorized manage jobs" on public.job_alerts for all using(public.has_admin_permission('manage_jobs')) with check(public.has_admin_permission('manage_jobs'));
drop policy if exists "published notifications visible" on public.notifications;drop policy if exists "admin manage notifications" on public.notifications;create policy "published notifications or authorized manager" on public.notifications for select using(published or public.has_admin_permission('manage_notifications'));create policy "authorized manage notifications" on public.notifications for all using(public.has_admin_permission('manage_notifications')) with check(public.has_admin_permission('manage_notifications'));
drop policy if exists "admin settings write" on public.site_settings;create policy "authorized settings write" on public.site_settings for all using(public.has_admin_permission('manage_settings')) with check(public.has_admin_permission('manage_settings'));
