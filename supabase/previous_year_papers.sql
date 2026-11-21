-- MISSION UNIFORM OP: Previous Year Questions support.
-- Apply AFTER test_system_upgrade.sql, manual_and_pool_tests.sql and
-- student_repeat_pool_engine.sql. This keeps the current student test engine.
begin;

alter table public.test_papers
  add column if not exists is_previous_year boolean not null default false,
  add column if not exists exam_year integer,
  add column if not exists exam_name text,
  add column if not exists session_label text,
  add column if not exists source_label text;

do $$ begin
  alter table public.test_papers add constraint test_papers_exam_year_valid
  check (exam_year is null or exam_year between 2000 and 2100);
exception when duplicate_object then null; end $$;

create index if not exists test_papers_previous_year_idx
  on public.test_papers(is_previous_year, exam_year desc, created_at desc)
  where status='published';

-- Admin can read/write pool tables; students cannot directly query answer keys.
alter table public.question_pools enable row level security;
alter table public.pool_questions enable row level security;

drop policy if exists question_pools_admin_all on public.question_pools;
create policy question_pools_admin_all on public.question_pools
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists pool_questions_admin_all on public.pool_questions;
create policy pool_questions_admin_all on public.pool_questions
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

grant select,insert,update,delete on public.question_pools,public.pool_questions to authenticated;

commit;
