-- MISSION UNIFORM OP: manual papers + per-student randomized question pools.
-- Additive migration. Existing question bank, papers, links and attempts are preserved.
begin;

alter table public.test_papers
  add column if not exists question_mode text not null default 'bank',
  add column if not exists pool_id uuid;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='test_papers_question_mode_check') then
    alter table public.test_papers add constraint test_papers_question_mode_check
      check (question_mode in ('bank','manual','pool'));
  end if;
end $$;

alter table public.test_attempts
  add column if not exists total_questions integer not null default 0,
  add column if not exists is_submitted boolean not null default true;
-- New attempts are explicitly opened by the start-test RPC; older rows remain submitted.
create table if not exists public.question_pools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  total_questions integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.manual_test_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.test_papers(id) on delete cascade,
  sort_order integer not null,
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
  created_at timestamptz not null default now(),
  unique(test_id, sort_order)
);

alter table public.test_papers
  drop constraint if exists test_papers_pool_id_fkey;
alter table public.test_papers
  add constraint test_papers_pool_id_fkey
  foreign key(pool_id) references public.question_pools(id) on delete set null;

create table if not exists public.test_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_source text not null check(question_source in ('bank','manual','pool')),
  question_id uuid references public.questions(id) on delete set null,
  manual_question_id uuid references public.manual_test_questions(id) on delete set null,
  pool_question_id uuid references public.pool_questions(id) on delete set null,
  sort_order integer not null,
  question_snapshot jsonb not null,
  unique(attempt_id,sort_order),
  check (
    (question_source='bank' and question_id is not null and manual_question_id is null and pool_question_id is null)
    or (question_source='manual' and question_id is null and manual_question_id is not null and pool_question_id is null)
    or (question_source='pool' and question_id is null and manual_question_id is null and pool_question_id is not null)
  )
);

-- A per-student shuffled queue guarantees no repeat until that student consumes the
-- whole pool. If fewer than one test's count remain, the old tail is kept first,
-- then a new shuffled cycle excluding that tail is appended.
create table if not exists public.student_pool_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.question_pools(id) on delete cascade,
  cycle_number integer not null default 1,
  question_queue uuid[] not null default '{}',
  next_index integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key(user_id,pool_id),
  check(next_index >= 1)
);

create index if not exists pool_questions_pool_idx on public.pool_questions(pool_id);
create index if not exists test_attempt_questions_attempt_idx on public.test_attempt_questions(attempt_id,sort_order);

create or replace function public.sync_question_pool_count()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    update public.question_pools set total_questions=total_questions+1,updated_at=now() where id=new.pool_id;
    return new;
  elsif tg_op='DELETE' then
    update public.question_pools set total_questions=greatest(0,total_questions-1),updated_at=now() where id=old.pool_id;
    return old;
  elsif tg_op='UPDATE' and old.pool_id is distinct from new.pool_id then
    update public.question_pools set total_questions=greatest(0,total_questions-1),updated_at=now() where id=old.pool_id;
    update public.question_pools set total_questions=total_questions+1,updated_at=now() where id=new.pool_id;
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
alter table public.manual_test_questions enable row level security;
alter table public.test_attempt_questions enable row level security;
alter table public.student_pool_progress enable row level security;

drop policy if exists question_pools_admin_all on public.question_pools;
create policy question_pools_admin_all on public.question_pools
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists pool_questions_admin_all on public.pool_questions;
create policy pool_questions_admin_all on public.pool_questions
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists manual_questions_admin_all on public.manual_test_questions;
create policy manual_questions_admin_all on public.manual_test_questions
for all to authenticated using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists attempt_questions_owner_read on public.test_attempt_questions;
create policy attempt_questions_owner_read on public.test_attempt_questions
for select to authenticated using(exists(
  select 1 from public.test_attempts a where a.id=attempt_id
  and (a.user_id=auth.uid() or public.is_super_admin())
));
drop policy if exists student_pool_progress_owner_read on public.student_pool_progress;
create policy student_pool_progress_owner_read on public.student_pool_progress
for select to authenticated using(user_id=auth.uid() or public.is_super_admin());

grant select,insert,update,delete on public.question_pools,public.pool_questions,public.manual_test_questions to authenticated;
grant select on public.test_attempt_questions,public.student_pool_progress to authenticated;

-- Private server-only RPC: the API validates the student's JWT and passes their id.
create or replace function public.start_test_attempt(p_test_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_test public.test_papers%rowtype;
  v_attempt_id uuid;
  v_count integer;
  v_order integer := 0;
  v_questions jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_selected uuid[];
  v_queue uuid[];
  v_tail uuid[];
  v_new_ids uuid[];
  v_next integer;
  v_cycle integer;
  r record;
begin
  if p_user_id is null then raise exception 'Student identity is required'; end if;
  select * into v_test from public.test_papers where id=p_test_id and status='published' for share;
  if not found then raise exception 'Test not found or not published'; end if;
  v_count := v_test.total_questions;
  if v_count < 1 then raise exception 'Test has no questions'; end if;

  insert into public.test_attempts(user_id,test_id,answers,score,correct_count,wrong_count,skipped_count,total_questions,started_at,submitted_at,is_submitted)
  values(p_user_id,p_test_id,'{}'::jsonb,0,0,0,v_count,v_count,now(),now(),false)
  returning id into v_attempt_id;

  if v_test.question_mode='pool' then
    if v_test.pool_id is null then raise exception 'Question pool is not configured'; end if;
    if (select count(*) from public.pool_questions where pool_id=v_test.pool_id) < v_count then
      raise exception 'Question pool has fewer questions than this test requires';
    end if;

    insert into public.student_pool_progress(user_id,pool_id,cycle_number,question_queue,next_index)
    values(p_user_id,v_test.pool_id,1,
      (select array_agg(id order by random()) from public.pool_questions where pool_id=v_test.pool_id),1)
    on conflict(user_id,pool_id) do nothing;

    select question_queue,next_index,cycle_number
      into v_queue,v_next,v_cycle
      from public.student_pool_progress
      where user_id=p_user_id and pool_id=v_test.pool_id
      for update;

    if coalesce(cardinality(v_queue),0)-v_next+1 < v_count then
      if coalesce(cardinality(v_queue),0)>=v_next then
        v_tail := v_queue[v_next:cardinality(v_queue)];
      else
        v_tail := '{}'::uuid[];
      end if;
      select coalesce(array_agg(id order by random()),'{}'::uuid[])
        into v_new_ids
        from public.pool_questions
        where pool_id=v_test.pool_id and not (id=any(coalesce(v_tail,'{}'::uuid[])));
      v_queue := coalesce(v_tail,'{}'::uuid[]) || v_new_ids;
      v_next := 1;
      v_cycle := v_cycle+1;
    end if;

    v_selected := v_queue[v_next:v_next+v_count-1];
    if coalesce(cardinality(v_selected),0)<>v_count then
      raise exception 'Unable to allocate enough pool questions';
    end if;

    update public.student_pool_progress
      set question_queue=v_queue,next_index=v_next+v_count,cycle_number=v_cycle,updated_at=now()
      where user_id=p_user_id and pool_id=v_test.pool_id;

    for r in
      select p.* from unnest(v_selected) with ordinality as picked(id,ord)
      join public.pool_questions p on p.id=picked.id
      order by picked.ord
    loop
      v_order := v_order+1;
      v_snapshot := jsonb_build_object(
        'id',r.id,'question_hi',r.question_hi,'question_or',r.question_or,'question_en',r.question_en,
        'options',r.options,'correct_option',upper(r.correct_option),
        'explanation_hi',r.explanation_hi,'explanation_or',r.explanation_or,
        'explanation_en',r.explanation_en,'chapter',r.chapter,'difficulty',r.difficulty
      );
      insert into public.test_attempt_questions(attempt_id,question_source,pool_question_id,sort_order,question_snapshot)
      values(v_attempt_id,'pool',r.id,v_order,v_snapshot);
      v_questions := v_questions || jsonb_build_array(v_snapshot-'correct_option'-'explanation_hi'-'explanation_or'-'explanation_en');
    end loop;

  elsif v_test.question_mode='manual' then
    for r in
      select * from public.manual_test_questions where test_id=p_test_id order by sort_order
    loop
      v_order := v_order+1;
      v_snapshot := jsonb_build_object(
        'id',r.id,'question_hi',r.question_hi,'question_or',r.question_or,'question_en',r.question_en,
        'options',r.options,'correct_option',upper(r.correct_option),
        'explanation_hi',r.explanation_hi,'explanation_or',r.explanation_or,
        'explanation_en',r.explanation_en,'chapter',r.chapter,'difficulty',r.difficulty
      );
      insert into public.test_attempt_questions(attempt_id,question_source,manual_question_id,sort_order,question_snapshot)
      values(v_attempt_id,'manual',r.id,v_order,v_snapshot);
      v_questions := v_questions || jsonb_build_array(v_snapshot-'correct_option'-'explanation_hi'-'explanation_or'-'explanation_en');
    end loop;

  else
    for r in
      select q.* from public.test_paper_questions l
      join public.questions q on q.id=l.question_id
      where l.test_id=p_test_id and coalesce(q.is_active,true)=true
      order by l.sort_order
    loop
      v_order := v_order+1;
      v_snapshot := jsonb_build_object(
        'id',r.id,'question_hi',r.question_hi,'question_or',r.question_or,'question_en',r.question_en,
        'options',r.options,'correct_option',upper(r.correct_option),
        'explanation_hi',r.explanation_hi,'explanation_or',r.explanation_or,
        'explanation_en',r.explanation_en,'chapter',r.chapter,'difficulty',r.difficulty
      );
      insert into public.test_attempt_questions(attempt_id,question_source,question_id,sort_order,question_snapshot)
      values(v_attempt_id,'bank',r.id,v_order,v_snapshot);
      v_questions := v_questions || jsonb_build_array(v_snapshot-'correct_option'-'explanation_hi'-'explanation_or'-'explanation_en');
    end loop;
  end if;

  if v_order<>v_count then raise exception 'Configured question count does not match actual questions'; end if;

  return jsonb_build_object(
    'attempt_id',v_attempt_id,
    'test',jsonb_build_object('id',v_test.id,'title',v_test.title,'description',v_test.description,
      'test_type',v_test.test_type,'duration_minutes',v_test.duration_minutes,
      'total_questions',v_test.total_questions,'marks_per_question',v_test.marks_per_question,
      'negative_marking',v_test.negative_marking,'question_mode',v_test.question_mode),
    'questions',v_questions
  );
end $$;

create or replace function public.submit_test_attempt(
  p_attempt_id uuid,p_test_id uuid,p_user_id uuid,p_answers jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_attempt public.test_attempts%rowtype;
  v_test public.test_papers%rowtype;
  v_total integer:=0;
  v_correct integer:=0;
  v_wrong integer:=0;
  v_skipped integer:=0;
  v_score numeric(10,2):=0;
  v_accuracy numeric(6,2):=0;
  v_selected integer;
  v_correct_idx integer;
  v_status text;
  v_review jsonb:='[]'::jsonb;
  r record;
begin
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then raise exception 'Invalid answer payload'; end if;
  select * into v_attempt from public.test_attempts
    where id=p_attempt_id and test_id=p_test_id and user_id=p_user_id for update;
  if not found then raise exception 'Test attempt not found'; end if;
  if v_attempt.is_submitted then raise exception 'This test attempt has already been submitted'; end if;
  select * into v_test from public.test_papers where id=p_test_id;
  if not found then raise exception 'Test does not exist'; end if;

  for r in
    select question_snapshot from public.test_attempt_questions
    where attempt_id=p_attempt_id order by sort_order
  loop
    v_total:=v_total+1;
    v_selected:=nullif(p_answers->>(r.question_snapshot->>'id'),'')::integer;
    v_correct_idx:=case upper(coalesce(r.question_snapshot->>'correct_option',''))
      when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3 else -1 end;
    if v_selected is null or v_selected<0 or v_selected>3 then
      v_skipped:=v_skipped+1; v_status:='skipped'; v_selected:=null;
    elsif v_selected=v_correct_idx then
      v_correct:=v_correct+1; v_score:=v_score+v_test.marks_per_question; v_status:='correct';
    else
      v_wrong:=v_wrong+1; v_score:=v_score-v_test.negative_marking; v_status:='wrong';
    end if;
    v_review:=v_review||jsonb_build_array(jsonb_build_object(
      'id',r.question_snapshot->>'id',
      'question',coalesce(r.question_snapshot->>'question_hi',r.question_snapshot->>'question_or',r.question_snapshot->>'question_en',''),
      'options',r.question_snapshot->'options',
      'selected',v_selected,
      'correct_option',r.question_snapshot->>'correct_option',
      'explanation',coalesce(r.question_snapshot->>'explanation_hi',r.question_snapshot->>'explanation_or',r.question_snapshot->>'explanation_en',''),
      'status',v_status
    ));
  end loop;

  if v_total=0 then raise exception 'No question snapshots found for this attempt'; end if;
  v_accuracy:=round((v_correct::numeric/v_total)*100,2);
  v_score:=round(v_score,2);

  update public.test_attempts set
    answers=p_answers,score=v_score,correct_count=v_correct,wrong_count=v_wrong,
    skipped_count=v_skipped,total_questions=v_total,submitted_at=now(),is_submitted=true
    where id=p_attempt_id;

  return jsonb_build_object(
    'success',true,'total',v_total,'accuracy',v_accuracy,
    'attempt',jsonb_build_object('id',p_attempt_id,'score',v_score,
      'correct_count',v_correct,'wrong_count',v_wrong,'skipped_count',v_skipped),
    'review',v_review
  );
end $$;

revoke all on function public.start_test_attempt(uuid,uuid) from public,anon,authenticated;
revoke all on function public.submit_test_attempt(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_test_attempt(uuid,uuid) to service_role;
grant execute on function public.submit_test_attempt(uuid,uuid,uuid,jsonb) to service_role;

commit;
