-- MISSION UNIFORM OP: restore the subject practice catalog RPC used by /api/subject-practice.
-- The API calls this function through the service-role Supabase client.
begin;

create index if not exists questions_subject_active_verified_idx
  on public.questions(subject_id)
  where is_active = true and verified = true;

create index if not exists test_papers_subject_random_published_idx
  on public.test_papers(subject_id)
  where question_mode = 'subject_random' and status = 'published';

create or replace function public.get_subject_practice_catalog_v1()
returns table (
  subject_id uuid,
  test_id uuid,
  verified_questions bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as subject_id,
    tp.id as test_id,
    count(q.id)::bigint as verified_questions
  from public.subjects s
  left join lateral (
    select p.id
    from public.test_papers p
    where p.subject_id = s.id
      and p.question_mode = 'subject_random'
      and p.status = 'published'
    limit 1
  ) tp on true
  left join public.questions q
    on q.subject_id = s.id
   and q.is_active = true
   and q.verified = true
  where s.is_active = true
  group by s.id, tp.id;
$$;

revoke all on function public.get_subject_practice_catalog_v1() from public, anon, authenticated;
grant execute on function public.get_subject_practice_catalog_v1() to service_role;

notify pgrst, 'reload schema';
commit;
