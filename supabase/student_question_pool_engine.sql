-- MISSION UNIFORM OP: student-specific question pools and repeat-cycle engine.
-- Additive only. Existing papers, questions and attempts remain intact.
begin;

alter table public.test_papers
  add column if not exists question_mode text not null default 'manual'
    check (question_mode in ('manual','pool')),
  add column if not exists pool_id uuid;

create table if not exists public.question_pools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject_id uuid references public.subjects(id) on delete set null,
  total_questions integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pool_questions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.question_pools(id) on delete cascade,
  question_hi text not null,
  question_or text,
  question_en text,
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_option text not null check(upper(correct_option) in ('A','B','C','D')),
  explanation text,
  chapter text,
  difficulty text not null default 'medium',
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.test_papers add constraint test_papers_pool_fk
    foreign key(pool_id) references public.question_pools(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.test_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  question_source text not null check(question_source in ('manual','pool')),
  question_id uuid references public.questions(id) on delete set null,
  pool_question_id uuid references public.pool_questions(id) on delete set null,
  sort_order integer not null,
  question_snapshot jsonb not null,
  unique(attempt_id,sort_order)
);

create table if not exists public.student_pool_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  pool_id uuid not null references public.question_pools(id) on delete cascade,
  pool_question_id uuid not null references public.pool_questions(id) on delete cascade,
  cycle_number integer not null default 1,
  seen_at timestamptz not null default now(),
  primary key(user_id,pool_id,pool_question_id,cycle_number)
);

create index if not exists pool_questions_pool_idx on public.pool_questions(pool_id);
create index if not exists student_pool_seen_idx on public.student_pool_seen(user_id,pool_id,cycle_number);

create or replace function public.refresh_pool_count()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    update question_pools set total_questions=total_questions+1 where id=new.pool_id;
    return new;
  elsif tg_op='DELETE' then
    update question_pools set total_questions=greatest(0,total_questions-1) where id=old.pool_id;
    return old;
  end if;
  return new;
end $$;
drop trigger if exists trg_refresh_pool_count on public.pool_questions;
create trigger trg_refresh_pool_count after insert or delete on public.pool_questions
for each row execute function public.refresh_pool_count();

-- Called only by the server using service-role credentials. Selects unseen questions
-- for this student. If fewer than requested remain, starts a fresh cycle (reshuffle).
create or replace function public.pick_student_pool_questions(
  p_user_id uuid, p_pool_id uuid, p_limit integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_cycle integer := 1;
  v_remaining integer := 0;
  v_total integer := 0;
  v_rows jsonb;
begin
  if p_limit < 1 or p_limit > 300 then raise exception 'Invalid question count'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || p_pool_id::text,0));

  select count(*) into v_total from pool_questions where pool_id=p_pool_id;
  if v_total < p_limit then raise exception 'Pool has only % questions; test requires %',v_total,p_limit; end if;

  select coalesce(max(cycle_number),1) into v_cycle
  from student_pool_seen where user_id=p_user_id and pool_id=p_pool_id;

  select count(*) into v_remaining from pool_questions q
  where q.pool_id=p_pool_id and not exists(
    select 1 from student_pool_seen s where s.user_id=p_user_id
      and s.pool_id=p_pool_id and s.pool_question_id=q.id and s.cycle_number=v_cycle
  );

  if v_remaining < p_limit then
    v_cycle := v_cycle + 1;
  end if;

  with chosen as (
    select q.* from pool_questions q
    where q.pool_id=p_pool_id and not exists(
      select 1 from student_pool_seen s where s.user_id=p_user_id
        and s.pool_id=p_pool_id and s.pool_question_id=q.id and s.cycle_number=v_cycle
    )
    order by random() limit p_limit
  ), marked as (
    insert into student_pool_seen(user_id,pool_id,pool_question_id,cycle_number)
    select p_user_id,p_pool_id,id,v_cycle from chosen
    on conflict do nothing
    returning pool_question_id
  )
  select coalesce(jsonb_agg(to_jsonb(c) order by random()),'[]'::jsonb)
  into v_rows from chosen c join marked m on m.pool_question_id=c.id;

  return jsonb_build_object('cycle',v_cycle,'questions',v_rows);
end $$;

alter table public.question_pools enable row level security;
alter table public.pool_questions enable row level security;
alter table public.test_attempt_questions enable row level security;
alter table public.student_pool_seen enable row level security;

drop policy if exists pools_admin_all on public.question_pools;
create policy pools_admin_all on public.question_pools for all to authenticated
  using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists pool_questions_admin_all on public.pool_questions;
create policy pool_questions_admin_all on public.pool_questions for all to authenticated
  using(public.is_super_admin()) with check(public.is_super_admin());
drop policy if exists attempt_questions_owner_read on public.test_attempt_questions;
create policy attempt_questions_owner_read on public.test_attempt_questions for select to authenticated
  using(exists(select 1 from test_attempts a where a.id=attempt_id and (a.user_id=auth.uid() or public.is_super_admin())));
drop policy if exists pool_seen_owner_read on public.student_pool_seen;
create policy pool_seen_owner_read on public.student_pool_seen for select to authenticated
  using(user_id=auth.uid() or public.is_super_admin());

grant select,insert,update,delete on public.question_pools,public.pool_questions to authenticated;
grant select on public.test_attempt_questions,public.student_pool_seen to authenticated;
revoke all on function public.pick_student_pool_questions(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.pick_student_pool_questions(uuid,uuid,integer) to service_role;

commit;
