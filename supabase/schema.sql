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
