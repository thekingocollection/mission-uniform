-- MISSION UNIFORM OP: high-concurrency indexes and set-based catalogue/leaderboard queries.
begin;
create index if not exists idx_test_papers_published_created on public.test_papers(status, created_at desc);
create index if not exists idx_test_papers_subject_mode_status on public.test_papers(subject_id, question_mode, status);
create index if not exists idx_questions_verified_subject on public.questions(subject_id) where is_active = true and verified = true;
create index if not exists idx_test_paper_questions_test_order on public.test_paper_questions(test_id, sort_order);
create index if not exists idx_test_attempts_user_submitted_date on public.test_attempts(user_id, submitted_at desc) where is_submitted = true;
create index if not exists idx_test_attempts_best_score on public.test_attempts(user_id, test_id, score desc, submitted_at desc) where is_submitted = true;
create index if not exists idx_test_attempt_questions_attempt_order on public.test_attempt_questions(attempt_id, sort_order);
create index if not exists idx_student_subject_access_user_subject on public.student_subject_access(user_id, subject_id, expires_at);
create index if not exists idx_job_alerts_published_last_date on public.job_alerts(last_date) where published = true;

create or replace function public.get_subject_practice_catalog_v1()
returns table(subject_id uuid, test_id uuid, verified_questions bigint)
language sql stable security definer set search_path = public
as $$
  with question_counts as (
    select q.subject_id, count(*)::bigint as verified_questions
    from public.questions q where q.is_active = true and q.verified = true group by q.subject_id
  ), practice_tests as (
    select distinct on (t.subject_id) t.subject_id, t.id as test_id
    from public.test_papers t
    where t.question_mode = 'subject_random' and t.status = 'published' and t.is_previous_year = false
    order by t.subject_id, t.created_at desc
  )
  select s.id, pt.test_id, coalesce(qc.verified_questions, 0)
  from public.subjects s
  left join question_counts qc on qc.subject_id = s.id
  left join practice_tests pt on pt.subject_id = s.id
  where s.is_active = true;
$$;

create or replace function public.get_student_leaderboard_v1()
returns table(user_id uuid, points numeric, tests bigint, correct bigint, questions bigint, rank bigint)
language sql stable security definer set search_path = public
as $$
  with best_attempt_per_test as (
    select distinct on (a.user_id, a.test_id)
      a.user_id, a.test_id, a.score, a.correct_count, a.total_questions
    from public.test_attempts a
    where a.is_submitted = true
    order by a.user_id, a.test_id, a.score desc nulls last, a.submitted_at desc
  ), totals as (
    select b.user_id,
      sum(greatest(coalesce(b.score, 0), 0))::numeric as points,
      count(*)::bigint as tests,
      sum(coalesce(b.correct_count, 0))::bigint as correct,
      sum(coalesce(b.total_questions, 0))::bigint as questions
    from best_attempt_per_test b group by b.user_id
  )
  select t.user_id, t.points, t.tests, t.correct, t.questions,
    row_number() over (order by t.points desc, t.tests desc,
      case when t.questions > 0 then t.correct::numeric / t.questions else 0 end desc,
      t.user_id)::bigint as rank
  from totals t;
$$;
revoke all on function public.get_subject_practice_catalog_v1() from public, anon, authenticated;
revoke all on function public.get_student_leaderboard_v1() from public, anon, authenticated;
grant execute on function public.get_subject_practice_catalog_v1() to service_role;
grant execute on function public.get_student_leaderboard_v1() to service_role;
notify pgrst, 'reload schema';
commit;
