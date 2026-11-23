-- Limit each browser/device identifier to at most two student accounts.
-- This is separate from the existing two-devices-per-account rule.
begin;

create or replace function public.claim_student_device_account_limit(
  p_user_id uuid,
  p_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_count integer;
  v_existing boolean;
  v_claim jsonb;
begin
  if p_user_id is null or p_device_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;

  -- Serialize claims for the same device to prevent simultaneous third-account signup.
  perform pg_advisory_xact_lock(hashtextextended('device:' || p_device_id::text, 0));

  select exists (
    select 1
    from public.student_device_bindings
    where device_id = p_device_id
      and user_id = p_user_id
  ) into v_existing;

  if not v_existing then
    select count(distinct user_id)
      into v_account_count
    from public.student_device_bindings
    where device_id = p_device_id;

    if v_account_count >= 2 then
      return jsonb_build_object(
        'allowed', false,
        'account_limit_reached', true,
        'max_accounts', 2
      );
    end if;
  end if;

  -- Preserve the existing per-account device quota/payment behavior.
  v_claim := public.claim_student_device_v2(p_user_id, p_device_id);
  return v_claim;
end;
$$;

revoke all on function public.claim_student_device_account_limit(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_student_device_account_limit(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
commit;
