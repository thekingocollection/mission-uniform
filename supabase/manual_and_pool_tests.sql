-- MISSION UNIFORM OP: manual papers + reusable per-student random pools.
-- Additive migration: keeps existing test_papers, test_paper_questions and test_attempts.
begin;

alter table public.test_papers
  add column if not exists question_mode text not null default 'bank'
    check (question_mode in ('bank','manual','pool')),
  add column if not exists pool_id uuid;

create table if not exists public.question_pools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  total_questions integer not null default 0,
  is_active boolean not null default true,
  cycle_number integer not null default 1,
  test_paper_id uuid references public.test_papers(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.question_pools add column if not exists test_paper_id uuid references public.test_papers(id) on delete cascade;

create table if not exists public.pool_questions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.question_pools(id) on delete cascade,
  question_hi text not null,
  question_or text,
  question_en text,
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_option text not null check(upper(correct_option) in ('A','B','C','D')),
  explanation_hi text,
  explanation_or text,
  explanation_en text,
  chapter text,
  difficulty text not null default 'medium',
  source_row integer,
  created_at timestamptz not null default now(),
  unique(pool_id, source_row)
);

do $$ begin
  alter table public.test_papers add constraint test_papers_pool_id_fkey foreign key(pool_id) references public.question_pools(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.student_pool_seen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.question_pools(id) on delete cascade,
  pool_question_id uuid not null references public.pool_questions(id) on delete cascade,
  cycle_number integer not null,
  first_seen_at timestamptz not null default now(),
  unique(user_id,pool_id,pool_question_id,cycle_number)
);

create index if not exists pool_questions_pool_idx on public.pool_questions(pool_id);
create index if not exists student_pool_seen_lookup_idx
  on public.student_pool_seen(user_id,pool_id,cycle_number);

create or replace function public.sync_question_pool_count()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    update public.question_pools set total_questions=total_questions+1, updated_at=now()
      where id=new.pool_id;
    return new;
  elsif tg_op='DELETE' then
    update public.question_pools set total_questions=greatest(0,total_questions-1), updated_at=now()
      where id=old.pool_id;
    return old;
  elsif tg_op='UPDATE' and old.pool_id<>new.pool_id then
    update public.question_pools set total_questions=greatest(0,total_questions-1),updated_at=now()
      where id=old.pool_id;
    update public.question_pools set total_questions=total_questions+1,updated_at=now()
      where id=new.pool_id;
    return new;
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_question_pool_count on public.pool_questions;
create trigger trg_sync_question_pool_count
after insert or update of pool_id or delete on public.pool_questions
for each row execute function public.sync_question_pool_count();

alter table public.question_pools enable row level security;
alter table public.pool_questions enable row level security;
alter table public.student_pool_seen enable row level security;

drop policy if exists question_pools_admin_all on public.question_pools;
create policy question_pools_admin_all on public.question_pools
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists pool_questions_admin_all on public.pool_questions;
create policy pool_questions_admin_all on public.pool_questions
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());

drop policy if exists student_pool_seen_owner_read on public.student_pool_seen;
create policy student_pool_seen_owner_read on public.student_pool_seen
for select to authenticated using(user_id=auth.uid() or public.is_super_admin());

grant select,insert,update,delete on public.question_pools,public.pool_questions to authenticated;
grant select on public.student_pool_seen to authenticated;
commit;

-- Questions from a pool are copied into each attempt snapshot at start.
-- When a student has seen every question in the current cycle, the next start
-- advances that pool's cycle and starts a fresh shuffle for that student.
