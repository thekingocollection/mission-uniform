-- MISSION UNIFORM OP: one permanent student account-to-device binding.
-- Run once in Supabase SQL Editor before deploying the application changes.
create table if not exists public.student_device_bindings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  device_id uuid not null,
  bound_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.student_device_bindings enable row level security;
revoke all on public.student_device_bindings from anon, authenticated;

create or replace function public.claim_student_device(p_user_id uuid, p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare existing_device uuid;
begin
  if p_user_id is null or p_device_id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select device_id into existing_device from public.student_device_bindings where user_id = p_user_id;
  if not found then
    insert into public.student_device_bindings(user_id, device_id) values (p_user_id, p_device_id);
    return true;
  end if;
  if existing_device <> p_device_id then return false; end if;
  update public.student_device_bindings set last_seen_at = now() where user_id = p_user_id;
  return true;
end;
$$;
revoke all on function public.claim_student_device(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_student_device(uuid, uuid) to service_role;

create or replace function public.check_student_device(p_device_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.student_device_bindings b
    where b.user_id = auth.uid() and b.device_id = p_device_id
  );
$$;
revoke all on function public.check_student_device(uuid) from public, anon;
grant execute on function public.check_student_device(uuid) to authenticated;
