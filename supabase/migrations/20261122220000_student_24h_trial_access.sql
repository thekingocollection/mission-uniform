-- MISSION UNIFORM OP: 24-hour account-based trial before subject purchases are required.
-- Trial starts from auth.users.created_at; purchased subjects remain accessible after trial expiry.
begin;

create or replace function public.enforce_subject_access_before_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_subject uuid;
  v_mode text;
  v_all_enabled boolean;
  v_subject_enabled boolean;
  v_expires_at timestamptz;
  v_user_created_at timestamptz;
begin
  if auth.role() = 'service_role' then return new; end if;
  select subject_id, question_mode into v_subject, v_mode
  from public.test_papers where id = new.test_id and status = 'published';
  if v_mode <> 'subject_random' then return new; end if;
  if v_user is null then raise exception 'Authentication required'; end if;

  select all_subjects_enabled into v_all_enabled
  from public.subject_access_global where singleton = true;
  select is_enabled into v_subject_enabled
  from public.subject_access_settings where subject_id = v_subject;
  if coalesce(v_all_enabled, true) = false or coalesce(v_subject_enabled, true) = false then
    raise exception 'This subject is currently locked by Admin';
  end if;

  select expires_at into v_expires_at
  from public.student_subject_access
  where user_id = v_user and subject_id = v_subject;
  if found and (v_expires_at is null or v_expires_at > now()) then
    return new;
  end if;

  select created_at into v_user_created_at from auth.users where id = v_user;
  if v_user_created_at is not null and now() < v_user_created_at + interval '24 hours' then
    return new;
  end if;

  raise exception 'Your 24-hour free trial has ended. Purchase this subject to continue.';
end;
$$;

notify pgrst, 'reload schema';
commit;
