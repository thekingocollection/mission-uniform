-- Subject-wise Normal / Easy mock test mode.
-- Apply after subject_random_practice.sql and student_custom_random_mock.sql.

begin;

-- Create a subject-random paper for every active subject, not only subjects
-- that already have 30 verified questions.
create or replace function public.ensure_subject_random_practice()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_subject uuid;
  v_name text;
begin
  if tg_table_name = 'subjects' then
    v_subject := new.id;
    if not new.is_active then return new; end if;
  else
    v_subject := new.subject_id;
    if v_subject is null then return new; end if;
  end if;

  select coalesce(name_en,name_hi,'Subject') into v_name
  from public.subjects where id=v_subject and is_active=true;

  if v_name is not null and not exists (
    select 1 from public.test_papers t
    where t.subject_id=v_subject and t.question_mode='subject_random'
      and t.status<>'archived'
  ) then
    insert into public.test_papers(
      title,description,test_type,subject_id,duration_minutes,total_questions,
      marks_per_question,negative_marking,status,created_by,question_mode,pool_id
    ) values (
      v_name || ' · Random Mock Test',
      'Random subject-wise practice test.',
      'subject',v_subject,30,30,1,0,'published',null,'subject_random',null
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_ensure_subject_random_practice on public.questions;
create trigger trg_ensure_subject_random_practice
after insert or update of subject_id,is_active,verified on public.questions
for each row execute function public.ensure_subject_random_practice();

drop trigger if exists trg_subject_random_practice_subject on public.subjects;
create trigger trg_subject_random_practice_subject
after insert or update of is_active,name_en,name_hi on public.subjects
for each row execute function public.ensure_subject_random_practice();

do $$
declare r record;
begin
  for r in select id,name_en,name_hi from public.subjects where is_active=true
  loop
    if not exists (
      select 1 from public.test_papers t
      where t.subject_id=r.id and t.question_mode='subject_random' and t.status<>'archived'
    ) then
      insert into public.test_papers(
        title,description,test_type,subject_id,duration_minutes,total_questions,
        marks_per_question,negative_marking,status,created_by,question_mode,pool_id
      ) values (
        coalesce(r.name_en,r.name_hi,'Subject') || ' · Random Mock Test',
        'Random subject-wise practice test.',
        'subject',r.id,30,30,1,0,'published',null,'subject_random',null
      );
    end if;
  end loop;
end $$;

-- Replace the current attempt RPC with a version that accepts Normal or Easy.
-- Normal samples from all active verified questions; Easy samples only difficulty=easy.
drop function if exists public.start_mock_test_attempt(uuid,integer);
drop function if exists public.start_mock_test_attempt(uuid);

create or replace function public.start_mock_test_attempt(
  p_test_id uuid,
  p_question_count integer default null,
  p_difficulty text default 'normal'
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_user uuid:=auth.uid();
 v_test public.test_papers%rowtype;
 v_attempt uuid;
 v_total integer:=0;
 v_cycle integer:=1;
 v_requested_count integer;
 v_rows jsonb:='[]'::jsonb;
 v_mode text:=case when lower(coalesce(p_difficulty,'normal'))='easy' then 'easy' else 'normal' end;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_test from public.test_papers where id=p_test_id and status='published';
 if not found then raise exception 'Test not found or not published'; end if;
 v_requested_count:=coalesce(p_question_count,30);

 if v_test.question_mode='subject_random' then
   if v_requested_count<1 or v_requested_count>100 then raise exception 'Choose between 1 and 100 questions'; end if;
   select count(*) into v_total from public.questions
     where subject_id=v_test.subject_id and is_active=true and verified=true
       and (v_mode<>'easy' or lower(coalesce(difficulty,''))='easy');
   v_requested_count:=least(v_requested_count,v_total);
   if v_requested_count=0 then
     if v_mode='easy' then raise exception 'Is subject ke liye abhi Easy questions available nahi hain. Normal Mock try karein.'; end if;
     raise exception 'Is subject ke liye abhi verified questions available nahi hain.';
   end if;
   v_test.total_questions:=v_requested_count;
   v_test.duration_minutes:=greatest(1,v_requested_count);
 elsif p_question_count is not null then
   raise exception 'Custom question count is only available for subject-wise random tests';
 end if;

 insert into public.test_attempts(user_id,test_id,answers,score,correct_count,wrong_count,skipped_count,total_questions,started_at,submitted_at)
 values(v_user,p_test_id,'{}'::jsonb,0,0,0,0,0,now(),now()) returning id into v_attempt;

 if v_test.question_mode='subject_random' then
   insert into public.test_attempt_questions(attempt_id,question_source,question_id,sort_order,question_snapshot)
   select v_attempt,'bank',q.id,row_number() over(order by random())::integer,
     jsonb_build_object('id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
      'question_en',q.question_en,'options',q.options,'chapter',q.chapter,
      'difficulty',q.difficulty,'correct_option',q.correct_option,
      'explanation',coalesce(q.explanation_hi,q.explanation_or,q.explanation_en,''))
   from (
     select * from public.questions
     where subject_id=v_test.subject_id and is_active=true and verified=true
       and (v_mode<>'easy' or lower(coalesce(difficulty,''))='easy')
     order by random() limit v_requested_count
   ) q;
 elsif v_test.question_mode in ('pool','manual') then
   if v_test.pool_id is null then raise exception 'Question pool is not configured'; end if;
   perform pg_advisory_xact_lock(hashtextextended(v_user::text||v_test.pool_id::text,0));
   if exists(select 1 from public.question_pools p where p.id=v_test.pool_id and p.test_paper_id is not null and p.test_paper_id<>p_test_id) then
     raise exception 'This question pool belongs to a different manual test'; end if;
   select count(*) into v_total from public.pool_questions where pool_id=v_test.pool_id;
   if v_total<v_test.total_questions then raise exception 'Question pool has fewer questions than requested'; end if;
   select coalesce(max(cycle_number),1) into v_cycle from public.student_pool_seen
     where user_id=v_user and pool_id=v_test.pool_id;
   if (select count(*) from public.student_pool_seen where user_id=v_user and pool_id=v_test.pool_id and cycle_number=v_cycle)+v_test.total_questions>v_total then
     v_cycle:=v_cycle+1; end if;
   with chosen as (
     select q.*,row_number() over(order by random()) as rn from public.pool_questions q
     where q.pool_id=v_test.pool_id and not exists(
       select 1 from public.student_pool_seen s where s.user_id=v_user and s.pool_id=q.pool_id
       and s.pool_question_id=q.id and s.cycle_number=v_cycle)
     order by random() limit v_test.total_questions
   ), marked as (
     insert into public.student_pool_seen(user_id,pool_id,pool_question_id,cycle_number)
     select v_user,v_test.pool_id,id,v_cycle from chosen on conflict do nothing returning pool_question_id
   )
   insert into public.test_attempt_questions(attempt_id,question_source,pool_question_id,sort_order,question_snapshot)
   select v_attempt,'pool',q.id,q.rn,
     jsonb_build_object('id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
      'question_en',q.question_en,'options',q.options,'chapter',q.chapter,'difficulty',q.difficulty,
      'correct_option',q.correct_option,'explanation',coalesce(q.explanation_hi,q.explanation_en,''))
   from chosen q join marked m on m.pool_question_id=q.id;
 else
   insert into public.test_attempt_questions(attempt_id,question_source,question_id,sort_order,question_snapshot)
   select v_attempt,case when v_test.question_mode='manual' then 'manual' else 'bank' end,
     q.id,tpq.sort_order,
     jsonb_build_object('id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
      'question_en',q.question_en,'options',q.options,'chapter',q.chapter,'difficulty',q.difficulty,
      'correct_option',q.correct_option,'explanation',coalesce(q.explanation_hi,q.explanation_or,q.explanation_en,''))
   from public.test_paper_questions tpq join public.questions q on q.id=tpq.question_id
   where tpq.test_id=p_test_id and q.is_active=true and q.verified=true order by tpq.sort_order;
 end if;

 select count(*) into v_total from public.test_attempt_questions where attempt_id=v_attempt;
 if v_total=0 then raise exception 'No eligible questions configured'; end if;
 update public.test_attempts set total_questions=v_total,skipped_count=v_total where id=v_attempt;
 select coalesce(jsonb_agg((question_snapshot-'correct_option'-'explanation')||jsonb_build_object('sort_order',sort_order) order by sort_order),'[]'::jsonb)
 into v_rows from public.test_attempt_questions where attempt_id=v_attempt;
 return jsonb_build_object('attempt_id',v_attempt,'test',jsonb_build_object(
   'id',v_test.id,'title',v_test.title,'description',v_test.description,
   'duration_minutes',v_test.duration_minutes,'total_questions',v_total,
   'marks_per_question',v_test.marks_per_question,'negative_marking',v_test.negative_marking),
   'questions',v_rows);
exception when others then
 if v_attempt is not null then delete from public.test_attempts where id=v_attempt; end if;
 raise;
end $$;

revoke all on function public.start_mock_test_attempt(uuid,integer,text) from public,anon;
grant execute on function public.start_mock_test_attempt(uuid,integer,text) to authenticated;

commit;
