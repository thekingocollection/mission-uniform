-- MISSION UNIFORM OP P0 reliability: canonical subjects, free practice, and per-student no-repeat sampling.
begin;

-- Ensure the six approved subjects exist and are active. Preserve existing subject IDs and question links.
with canonical(slug,name,name_en,name_hi,name_od,name_or,description,sort_order,aliases) as (
  values
  ('odia-grammar','Odia Grammar','Odia Grammar','ओड़िया व्याकरण','ଓଡ଼ିଆ ବ୍ୟାକରଣ','ଓଡ଼ିଆ ବ୍ୟାକରଣ','Odia language and grammar.',1,array['odia','odiagrammar','odiyagrammar']::text[]),
  ('english-grammar','English Grammar','English Grammar','अंग्रेज़ी व्याकरण','ଇଂରାଜୀ ବ୍ୟାକରଣ','ଇଂରାଜୀ ବ୍ୟାକରଣ','English grammar and language practice.',2,array['english','englishgrammar']::text[]),
  ('general-knowledge','General Knowledge','General Knowledge','सामान्य ज्ञान','ସାଧାରଣ ଜ୍ଞାନ','ସାଧାରଣ ଜ୍ଞାନ','India, Odisha, world, science and current affairs.',3,array['gk','generalknowledge','generalknowledgeandcurrentaffairs']::text[]),
  ('quantitative-aptitude','Quantitative Aptitude','Quantitative Aptitude','मात्रात्मक योग्यता','ଗଣିତ','ଗଣିତ','Arithmetic and quantitative problem solving.',4,array['math','mathematics','quantitative','quantitativeaptitude','arithmetic']::text[]),
  ('reasoning','Reasoning','Reasoning','तर्कशक्ति','ଯୁକ୍ତିତର୍କ','ଯୁକ୍ତିତର୍କ','Logical, verbal and non-verbal reasoning.',5,array['logicalreasoning','mentalability']::text[]),
  ('basic-computer-literacy','Basic Computer Literacy','Basic Computer Literacy','मूल कंप्यूटर साक्षरता','ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ','ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ','Basic computer knowledge and digital literacy.',6,array['computer','computerawareness','computerknowledge','basiccomputer','basiccomputerliteracy','computerliteracy','computerfundamentals','computerapplications','informationtechnology','it']::text[])
), existing_matches as (
  select c.*, s.id as subject_id
  from canonical c
  join lateral (
    select id from public.subjects s
    where regexp_replace(lower(coalesce(s.name_en,s.name,'')),'[^a-z0-9]','','g') = any(c.aliases || array[regexp_replace(lower(c.name_en),'[^a-z0-9]','','g')])
       or regexp_replace(lower(coalesce(s.slug,'')),'[^a-z0-9]','','g') = any(c.aliases || array[regexp_replace(lower(c.slug),'[^a-z0-9]','','g')])
    order by s.sort_order nulls last, s.created_at nulls last
    limit 1
  ) s on true
)
update public.subjects s
set is_active=true, published=true,
    name_en=e.name_en, name_hi=e.name_hi, name_or=e.name_or,
    name=e.name, name_od=e.name_od, description=e.description, sort_order=e.sort_order
from existing_matches e
where s.id=e.subject_id;

with canonical(slug,name,name_en,name_hi,name_od,name_or,description,sort_order,aliases) as (
  values
  ('odia-grammar','Odia Grammar','Odia Grammar','ओड़िया व्याकरण','ଓଡ଼ିଆ ବ୍ୟାକରଣ','ଓଡ଼ିଆ ବ୍ୟାକରଣ','Odia language and grammar.',1,array['odia','odiagrammar','odiyagrammar']::text[]),
  ('english-grammar','English Grammar','English Grammar','अंग्रेज़ी व्याकरण','ଇଂରାଜୀ ବ୍ୟାକରଣ','ଇଂରାଜୀ ବ୍ୟାକରଣ','English grammar and language practice.',2,array['english','englishgrammar']::text[]),
  ('general-knowledge','General Knowledge','General Knowledge','सामान्य ज्ञान','ସାଧାରଣ ଜ୍ଞାନ','ସାଧାରଣ ଜ୍ଞାନ','India, Odisha, world, science and current affairs.',3,array['gk','generalknowledge','generalknowledgeandcurrentaffairs']::text[]),
  ('quantitative-aptitude','Quantitative Aptitude','Quantitative Aptitude','मात्रात्मक योग्यता','ଗଣିତ','ଗଣିତ','Arithmetic and quantitative problem solving.',4,array['math','mathematics','quantitative','quantitativeaptitude','arithmetic']::text[]),
  ('reasoning','Reasoning','Reasoning','तर्कशक्ति','ଯୁକ୍ତିତର୍କ','ଯୁକ୍ତିତର୍କ','Logical, verbal and non-verbal reasoning.',5,array['logicalreasoning','mentalability']::text[]),
  ('basic-computer-literacy','Basic Computer Literacy','Basic Computer Literacy','मूल कंप्यूटर साक्षरता','ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ','ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ','Basic computer knowledge and digital literacy.',6,array['computer','computerawareness','computerknowledge','basiccomputer','basiccomputerliteracy','computerliteracy','computerfundamentals','computerapplications','informationtechnology','it']::text[])
)
insert into public.subjects(slug,name,name_en,name_hi,name_od,name_or,description,sort_order,is_active,published)
select c.slug,c.name,c.name_en,c.name_hi,c.name_od,c.name_or,c.description,c.sort_order,true,true
from canonical c
where not exists (
  select 1 from public.subjects s
  where regexp_replace(lower(coalesce(s.name_en,s.name,'')),'[^a-z0-9]','','g') = any(c.aliases || array[regexp_replace(lower(c.name_en),'[^a-z0-9]','','g')])
     or regexp_replace(lower(coalesce(s.slug,'')),'[^a-z0-9]','','g') = any(c.aliases || array[regexp_replace(lower(c.slug),'[^a-z0-9]','','g')])
)
on conflict(slug) do update set
  name=excluded.name,name_en=excluded.name_en,name_hi=excluded.name_hi,
  name_od=excluded.name_od,name_or=excluded.name_or,description=excluded.description,
  sort_order=excluded.sort_order,is_active=true,published=true;

-- Create a subject practice paper even when a subject has fewer than 30 questions.
-- The student chooses a count up to the currently verified question count.
create or replace function public.ensure_subject_random_practice()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_subject uuid := new.subject_id;
  v_name text;
begin
  if v_subject is null then return new; end if;
  select coalesce(name_en,name_hi,name,'Subject') into v_name
  from public.subjects where id=v_subject and is_active=true;
  if v_name is not null and not exists (
    select 1 from public.test_papers t
    where t.subject_id=v_subject and t.question_mode='subject_random' and t.status<>'archived'
  ) then
    insert into public.test_papers(
      title,description,test_type,subject_id,duration_minutes,total_questions,
      marks_per_question,negative_marking,status,created_by,question_mode,pool_id
    ) values (
      v_name || ' · Random Mock Test',
      'Each attempt receives a student-specific random set from the verified subject question bank.',
      'subject',v_subject,30,30,1,0,'published',null,'subject_random',null
    );
  end if;
  return new;
end $$;

insert into public.test_papers(
  title,description,test_type,subject_id,duration_minutes,total_questions,
  marks_per_question,negative_marking,status,created_by,question_mode,pool_id
)
select coalesce(s.name_en,s.name_hi,s.name,'Subject') || ' · Random Mock Test',
       'Each attempt receives a student-specific random set from the verified subject question bank.',
       'subject',s.id,30,30,1,0,'published',null,'subject_random',null
from public.subjects s
where s.is_active=true
  and regexp_replace(lower(coalesce(s.name_en,s.name,'')),'[^a-z0-9]','','g')
      = any(array['odiagrammar','englishgrammar','generalknowledge','quantitativeaptitude','reasoning','basiccomputerliteracy'])
  and not exists (
    select 1 from public.test_papers t
    where t.subject_id=s.id and t.question_mode='subject_random' and t.status<>'archived'
  );

-- No paid entitlement is required for student subject-wise practice.
-- Start all approved subjects unlocked; Super Admin can still use the existing lock controls later.
update public.subject_access_global set all_subjects_enabled=true where singleton=true;
update public.subject_access_settings set is_enabled=true;
-- Admin global/per-subject switches remain available as emergency controls.
create or replace function public.enforce_subject_access_before_attempt()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_subject uuid;
  v_mode text;
  v_all_enabled boolean;
  v_subject_enabled boolean;
begin
  if auth.role()='service_role' then return new; end if;
  select subject_id,question_mode into v_subject,v_mode
  from public.test_papers where id=new.test_id and status='published';
  if v_mode is distinct from 'subject_random' then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select all_subjects_enabled into v_all_enabled from public.subject_access_global where singleton=true;
  select is_enabled into v_subject_enabled from public.subject_access_settings where subject_id=v_subject;
  if coalesce(v_all_enabled,true)=false or coalesce(v_subject_enabled,true)=false then
    raise exception 'This subject is currently unavailable. Please contact Admin.';
  end if;
  return new;
end $$;

-- Student-specific question history: no repeats until a subject's eligible bank is exhausted.
create table if not exists public.student_subject_question_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  cycle_number integer not null,
  seen_at timestamptz not null default now(),
  primary key(user_id,subject_id,question_id,cycle_number)
);
create index if not exists student_subject_question_seen_lookup_idx
  on public.student_subject_question_seen(user_id,subject_id,cycle_number);
alter table public.student_subject_question_seen enable row level security;
revoke all on public.student_subject_question_seen from anon,authenticated;
grant all on public.student_subject_question_seen to service_role;

create or replace function public.start_mock_test_attempt(p_test_id uuid,p_question_count integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_user uuid:=auth.uid();
 v_test public.test_papers%rowtype;
 v_attempt uuid;
 v_total integer:=0;
 v_cycle integer:=1;
 v_requested_count integer;
 v_rows jsonb:='[]'::jsonb;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select * into v_test from public.test_papers where id=p_test_id and status='published';
 if not found then raise exception 'Test not found or not published'; end if;
 v_requested_count:=coalesce(p_question_count,v_test.total_questions);
 if v_test.question_mode='subject_random' then
   if v_requested_count<1 or v_requested_count>100 then raise exception 'Choose between 1 and 100 questions'; end if;
   v_test.total_questions:=v_requested_count;
   v_test.duration_minutes:=greatest(1,v_requested_count);
 elsif p_question_count is not null then
   raise exception 'Custom question count is only available for subject-wise random tests';
 end if;

 insert into public.test_attempts(user_id,test_id,answers,score,correct_count,wrong_count,skipped_count,total_questions,started_at,submitted_at)
 values(v_user,p_test_id,'{}'::jsonb,0,0,0,0,0,now(),now()) returning id into v_attempt;

 if v_test.question_mode='subject_random' then
   if v_test.subject_id is null then raise exception 'Subject is not configured for this mock test'; end if;
   select count(*) into v_total from public.questions
     where subject_id=v_test.subject_id and is_active=true and verified=true;
   if v_total<v_requested_count then
     raise exception 'Only % verified questions are available for this subject',v_total;
   end if;
   perform pg_advisory_xact_lock(hashtextextended(v_user::text||v_test.subject_id::text,0));
   select coalesce(max(cycle_number),1) into v_cycle
   from public.student_subject_question_seen where user_id=v_user and subject_id=v_test.subject_id;
   if (select count(*) from public.student_subject_question_seen
       where user_id=v_user and subject_id=v_test.subject_id and cycle_number=v_cycle)+v_requested_count>v_total then
     v_cycle:=v_cycle+1;
   end if;
   with chosen as (
     select q.*,row_number() over(order by random())::integer as rn
     from public.questions q
     where q.subject_id=v_test.subject_id and q.is_active=true and q.verified=true
       and not exists (
         select 1 from public.student_subject_question_seen seen
         where seen.user_id=v_user and seen.subject_id=v_test.subject_id
           and seen.question_id=q.id and seen.cycle_number=v_cycle
       )
     order by random() limit v_requested_count
   ), marked as (
     insert into public.student_subject_question_seen(user_id,subject_id,question_id,cycle_number)
     select v_user,v_test.subject_id,id,v_cycle from chosen
     on conflict do nothing returning question_id
   )
   insert into public.test_attempt_questions(attempt_id,question_source,question_id,sort_order,question_snapshot)
   select v_attempt,'bank',q.id,q.rn,
     jsonb_build_object('id',q.id,'question_hi',q.question_hi,'question_or',q.question_or,
      'question_en',q.question_en,'options',q.options,'chapter',q.chapter,
      'difficulty',q.difficulty,'correct_option',q.correct_option,
      'explanation',coalesce(q.explanation_hi,q.explanation_or,q.explanation_en,''))
   from chosen q join marked m on m.question_id=q.id;
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
       select 1 from public.student_pool_seen seen where seen.user_id=v_user and seen.pool_id=v_test.pool_id
       and seen.pool_question_id=q.id and seen.cycle_number=v_cycle)
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

revoke all on function public.start_mock_test_attempt(uuid,integer) from public,anon;
grant execute on function public.start_mock_test_attempt(uuid,integer) to authenticated;

notify pgrst,'reload schema';
commit;
