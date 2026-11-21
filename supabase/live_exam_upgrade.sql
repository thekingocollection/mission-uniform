
-- MISSION UNIFORM OP: live question bank + secure attempt grading
-- Run AFTER schema.sql in Supabase SQL Editor.
drop policy if exists "published questions visible" on public.questions;
grant select, insert, update, delete on public.questions to authenticated;
grant select on public.public_questions to anon, authenticated;
create or replace view public.public_questions as
 select q.id, q.subject_id, q.chapter_id, q.question, q.question_od,
        q.options, q.difficulty, s.name as subject_name
 from public.questions q
 left join public.subjects s on s.id=q.subject_id
 where q.published=true;

alter view public.public_questions reset (security_invoker);

create or replace function public.submit_mock_attempt(
  p_title text,
  p_answers jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_score integer := 0;
  v_total integer := 0;
  v_id uuid;
  v_correct jsonb := '{}'::jsonb;
  r record;
  v_choice integer;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb)) <> 'object' then
    raise exception 'Invalid answers';
  end if;

  for r in
    select id, correct_index
    from public.questions
    where published=true
      and id::text in (select jsonb_object_keys(coalesce(p_answers,'{}'::jsonb)))
  loop
    v_total := v_total + 1;
    v_choice := (p_answers ->> r.id::text)::integer;
    if v_choice = r.correct_index then v_score := v_score + 1; end if;
    v_correct := v_correct || jsonb_build_object(r.id::text, r.correct_index);
  end loop;

  insert into public.attempts(user_id,title,score,total,answers)
  values(v_user, coalesce(nullif(p_title,''),'Mock Test'),v_score,v_total,
         jsonb_build_object('selected',coalesce(p_answers,'{}'::jsonb),'correct',v_correct))
  returning id into v_id;

  return jsonb_build_object('id',v_id,'score',v_score,'total',v_total,
                            'submitted_at',now());
end;
$$;
revoke all on function public.submit_mock_attempt(text,jsonb) from public, anon;
grant execute on function public.submit_mock_attempt(text,jsonb) to authenticated;
