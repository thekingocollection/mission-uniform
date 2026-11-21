-- MISSION UNIFORM OP: safe test-paper engine for the CURRENT questions/subjects schema.
-- Run this file in Supabase SQL Editor. It does not replace or alter existing attempts.
create extension if not exists pgcrypto;

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects(id) on delete set null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(subject_id, name)
);

create table if not exists public.test_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  test_type text not null check (test_type in ('daily','subject','chapter','full','grand')),
  subject_id uuid references public.subjects(id) on delete set null,
  chapter text,
  duration_minutes integer not null default 30 check(duration_minutes between 1 and 300),
  total_questions integer not null default 10 check(total_questions between 1 and 300),
  marks_per_question numeric(6,2) not null default 1,
  negative_marking numeric(6,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  publish_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_paper_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.test_papers(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order integer not null default 0,
  unique(test_id, question_id)
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_id uuid not null references public.test_papers(id) on delete restrict,
  answers jsonb not null default '{}'::jsonb,
  score numeric(10,2) not null default 0,
  correct_count integer not null default 0,
  wrong_count integer not null default 0,
  skipped_count integer not null default 0,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

-- Keep the chapter catalogue synchronized from Excel/question imports.
create or replace function public.sync_question_chapter()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.chapter is not null and length(trim(new.chapter)) > 0 then
    insert into public.chapters(subject_id,name)
    values(new.subject_id,trim(new.chapter))
    on conflict(subject_id,name) do update set is_active=true;
  end if;
  return new;
end $$;
drop trigger if exists trg_sync_question_chapter on public.questions;
create trigger trg_sync_question_chapter after insert or update of chapter,subject_id
on public.questions for each row execute function public.sync_question_chapter();

alter table public.chapters enable row level security;
alter table public.test_papers enable row level security;
alter table public.test_paper_questions enable row level security;
alter table public.test_attempts enable row level security;

drop policy if exists chapters_read_active on public.chapters;
create policy chapters_read_active on public.chapters for select to anon,authenticated using(is_active=true);
drop policy if exists chapters_admin_all on public.chapters;
create policy chapters_admin_all on public.chapters for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists test_papers_published_read on public.test_papers;
create policy test_papers_published_read on public.test_papers for select to anon,authenticated using(status='published' or public.is_super_admin());
drop policy if exists test_papers_admin_write on public.test_papers;
create policy test_papers_admin_write on public.test_papers for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists test_paper_questions_read on public.test_paper_questions;
create policy test_paper_questions_read on public.test_paper_questions for select to anon,authenticated
using(exists(select 1 from public.test_papers t where t.id=test_id and (t.status='published' or public.is_super_admin())));
drop policy if exists test_paper_questions_admin_write on public.test_paper_questions;
create policy test_paper_questions_admin_write on public.test_paper_questions for all to authenticated
using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists test_attempts_owner_read on public.test_attempts;
create policy test_attempts_owner_read on public.test_attempts for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
-- Inserts are performed only by the server after it validates the user's JWT.
grant select on public.chapters, public.test_papers, public.test_paper_questions to anon,authenticated;
grant all on public.chapters, public.test_papers, public.test_paper_questions to authenticated;
grant select on public.test_attempts to authenticated;
