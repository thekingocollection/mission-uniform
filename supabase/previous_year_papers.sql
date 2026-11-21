-- MISSION UNIFORM OP: Previous Year Question Paper metadata.
-- Run after test-system and manual/pool migrations.
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
commit;
