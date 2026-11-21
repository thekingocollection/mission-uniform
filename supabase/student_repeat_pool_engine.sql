-- MISSION UNIFORM OP: student-wise repeat policy and atomic question allocation.
-- Run after test_system_upgrade.sql and manual_and_pool_tests.sql.
begin;

alter table public.test_papers
  add column if not exists question_mode text not null default 'bank';
alter table public.test_papers
  drop constraint if exists test_papers_question_mode_check;
alter table public.test_papers
  add constraint test_papers_question_mode_check
  check (question_mode in ('bank','manual','pool'));

create table if not exists public.test_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_source text not null check (question_source in ('bank','manual','pool')),
  question_id uuid,
  pool_question_id uuid references public.pool_questions(id) on delete restrict,
  sort_order integer not null,
  question_snapshot jsonb not null,
  unique(attempt_id, sort_order),
  check (
    (question_source='pool' and pool_question_id is not null and question_id is null)
    or (question_source in ('bank','manual') and question_id is not null and pool_question_id is null)
  )
);

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
create index if not exists student_pool_seen_lookup_idx on public.student_pool_seen(user_id,pool_id,cycle_number);
create index if not exists attempt_questions_attempt_idx on public.test_attempt_questions(attempt_id,sort_order);

alter table public.test_attempt_questions enable row level security;
alter table public.student_pool_seen enable row level security;
drop policy if exists attempt_questions_owner_read on public.test_attempt_questions;
create policy attempt_questions_owner_read on public.test_attempt_questions
for select to authenticated using (
  exists (select 1 from public.test_attempts a
    where a.id=attempt_id and (a.user_id=auth.uid() or public.is_super_admin()))
);
drop policy if exists student_pool_seen_owner_read on public.student_pool_seen;
create policy student_pool_seen_owner_read on public.student_pool_seen
for select to authenticated using(user_id=auth.uid() or public.is_super_admin());
grant select on public.test_attempt_questions, public.student_pool_seen to authenticated;

-- One atomic call starts an attempt and reserves its question set. The row lock
-- serializes simultaneous starts for the same pool and student.
create or replace function public.start_mock_test_attempt(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_test public.test_papers%rowtype;
  v_pool public.question_pools%rowtype;
  v_attempt uuid;
  v_cycle integer := 1;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select * into v_test from public.test_papers
   where id=p_test_id and status='published';
  if not found then raise exception 'Test not found or not published'; end if;

  insert into public.test_attempts
    (user_id,test_id,answers,score,correct_count,wrong_count,skipped_count,total_questions,started_at,submitted_at)
  values (v_user,p_test_id,'{}'::jsonb,0,0,0,0,0,now(),now())
  returning id into v_attempt;

  if v_test.question_mode='pool' then
    if v_test.pool_id is null then raise exception 'This test has no question pool assigned'; end if;
    select * into v_pool from public.question_pools where id=v_test.pool_id and is_active=true for update;
    if not found then raise exception 'Question pool is unavailable'; end if;
    select count(*) into v_total from public.pool_questions where pool_id=v_pool.id;
    if v_total=0 then raise exception 'Question pool is empty'; end if;

    select coalesce(max(cycle_number),1) into v_cycle
      from public.student_pool_seen where user_id=v_user and pool_id=v_pool.id;
    if (select count(*) from public.student_pool_seen
        where user_id=v_user and pool_id=v_pool.id and cycle_number=v_cycle) >= v_total then
      v_cycle := v_cycle + 1;
    end if;

    with chosen as (
      select q.*,
        row_number() over(order by random()) as rn
      from public.pool_questions q
      where q.pool_id=v_pool.id
        and not exists (
          select 1 from public.student_pool_seen s
          where s.user_id=v_user and s.pool_id=v_pool.id
            and s.pool_question_id=q.id and s.cycle_number=v_cycle
        )
      order by random()
      limit least(v_test.total_questions,v_total)
    ), saved as (
      insert into public.student_pool_seen(user_id,pool_id,pool_question_id,cycle_number)
      select v_user,v_pool.id,id,v_cycle from chosen
      returning pool_question_id
    )
    insert into public.test_attempt_questions
      (attempt_id,question_source,pool_question_id,sort_order,question_snapshot)
    select v_attempt,'pool',q.id,row_number() over(order by q.rn),
      jsonb_build_object(
        'id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
        'question_en',q.question_en,'options',q.options,'correct_option',q.correct_option,
        'explanation',q.explanation_hi,'chapter',q.chapter,'difficulty',q.difficulty
      )
    from chosen q;

  else
    insert into public.test_attempt_questions
      (attempt_id,question_source,question_id,sort_order,question_snapshot)
    select v_attempt,
      case when v_test.question_mode='manual' then 'manual' else 'bank' end,
      q.id,tpq.sort_order,
      jsonb_build_object(
        'id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
        'question_en',q.question_en,'options',q.options,'correct_option',q.correct_option,
        'explanation',q.explanation,'chapter',q.chapter,'difficulty',q.difficulty
      )
    from public.test_paper_questions tpq
    join public.questions q on q.id=tpq.question_id
    where tpq.test_id=p_test_id and q.is_active=true and q.verified=true
    order by tpq.sort_order;
  end if;

  select count(*) into v_total from public.test_attempt_questions where attempt_id=v_attempt;
  if v_total=0 then raise exception 'No eligible questions are configured for this test'; end if;

  update public.test_attempts set total_questions=v_total where id=v_attempt;

  select coalesce(jsonb_agg(
    (question_snapshot - 'correct_option' - 'explanation')
      || jsonb_build_object('sort_order',sort_order)
    order by sort_order
  ),'[]'::jsonb)
  into v_rows from public.test_attempt_questions where attempt_id=v_attempt;

  return jsonb_build_object(
    'attempt_id',v_attempt,'total_questions',v_total,
    'test',jsonb_build_object('id',v_test.id,'title',v_test.title,
      'description',v_test.description,'duration_minutes',v_test.duration_minutes,
      'marks_per_question',v_test.marks_per_question,
      'negative_marking',v_test.negative_marking),
    'questions',v_rows
  );
exception when others then
  if v_attempt is not null then
    delete from public.test_attempts where id=v_attempt;
  end if;
  raise;
end;
$$;

revoke all on function public.start_mock_test_attempt(uuid) from public,anon;
grant execute on function public.start_mock_test_attempt(uuid) to authenticated;
commit;
