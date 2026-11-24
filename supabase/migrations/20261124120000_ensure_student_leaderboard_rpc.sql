-- Ensure the leaderboard RPC exists in Supabase and is executable by the server service role.
begin;

create or replace function public.get_student_leaderboard_v1()
returns table(
  user_id uuid,
  points numeric,
  tests bigint,
  correct bigint,
  questions bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with best_attempt_per_test as (
    select distinct on (a.user_id, a.test_id)
      a.user_id,
      a.test_id,
      a.score,
      a.correct_count,
      a.total_questions
    from public.test_attempts a
    where a.is_submitted = true
    order by
      a.user_id,
      a.test_id,
      a.score desc nulls last,
      a.submitted_at desc
  ),
  totals as (
    select
      b.user_id,
      sum(greatest(coalesce(b.score, 0), 0))::numeric as points,
      count(*)::bigint as tests,
      sum(coalesce(b.correct_count, 0))::bigint as correct,
      sum(coalesce(b.total_questions, 0))::bigint as questions
    from best_attempt_per_test b
    group by b.user_id
  )
  select
    t.user_id,
    t.points,
    t.tests,
    t.correct,
    t.questions,
    row_number() over (
      order by
        t.points desc,
        t.tests desc,
        case when t.questions > 0
          then t.correct::numeric / t.questions
          else 0
        end desc,
        t.user_id
    )::bigint as rank
  from totals t;
$$;

revoke all on function public.get_student_leaderboard_v1() from public, anon, authenticated;
grant execute on function public.get_student_leaderboard_v1() to service_role;

notify pgrst, 'reload schema';
commit;
