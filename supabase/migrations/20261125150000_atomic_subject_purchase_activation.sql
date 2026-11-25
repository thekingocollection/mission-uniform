-- MISSION UNIFORM OP: make successful subject purchase activation atomic and safely retryable.
-- Apply after 20261123120000_finance_report_purchase_snapshots.sql.
-- The API verifies Razorpay's HMAC and captured payment before calling this RPC.
begin;

create or replace function public.activate_subject_purchase(
  p_order_id text,
  p_payment_id text,
  p_user_id uuid,
  p_amount_paise integer,
  p_paid_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.subject_payment_transactions%rowtype;
  v_duration_days integer;
  v_expires_at timestamptz;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_product_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_order_id is null or p_payment_id is null or p_user_id is null
     or p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Invalid purchase activation request';
  end if;

  select *
    into v_tx
    from public.subject_payment_transactions
   where razorpay_order_id = p_order_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'Payment order not found for this student';
  end if;

  if v_tx.amount_paise <> p_amount_paise or v_tx.currency <> 'INR' then
    raise exception 'Payment amount or currency does not match the order';
  end if;

  select coalesce(nullif(s.name_en, ''), nullif(s.name_hi, ''), 'Subject'),
         cfg.duration_days
    into v_product_name, v_duration_days
    from public.subjects s
    left join public.subject_access_settings cfg on cfg.subject_id = s.id
   where s.id = v_tx.subject_id
     and s.is_active = true;

  if not found then
    raise exception 'Purchased subject is no longer active';
  end if;

  -- Idempotent repair path: if payment was marked paid but access activation
  -- was interrupted previously, retry the same verified payment and restore access.
  if v_tx.status = 'paid' then
    if v_tx.razorpay_payment_id is distinct from p_payment_id then
      raise exception 'This order is already linked to a different payment';
    end if;

    insert into public.student_subject_access
      (user_id, subject_id, purchased_at, expires_at, last_payment_id)
    values
      (p_user_id, v_tx.subject_id, coalesce(v_tx.paid_at, v_paid_at),
       v_tx.access_expires_at, p_payment_id)
    on conflict (user_id, subject_id) do update
      set purchased_at = excluded.purchased_at,
          expires_at = excluded.expires_at,
          last_payment_id = excluded.last_payment_id;

    return jsonb_build_object(
      'success', true,
      'already_paid', true,
      'expires_at', v_tx.access_expires_at,
      'product_name', v_product_name
    );
  end if;

  if v_tx.status <> 'created' then
    raise exception 'Payment order is not in a payable state';
  end if;

  v_expires_at := case
    when v_duration_days is null then null
    else v_paid_at + make_interval(days => v_duration_days)
  end;

  update public.subject_payment_transactions
     set status = 'paid',
         razorpay_payment_id = p_payment_id,
         paid_at = v_paid_at,
         product_name = v_product_name,
         access_duration_days = v_duration_days,
         access_expires_at = v_expires_at
   where id = v_tx.id;

  insert into public.student_subject_access
    (user_id, subject_id, purchased_at, expires_at, last_payment_id)
  values
    (p_user_id, v_tx.subject_id, v_paid_at, v_expires_at, p_payment_id)
  on conflict (user_id, subject_id) do update
    set purchased_at = excluded.purchased_at,
        expires_at = excluded.expires_at,
        last_payment_id = excluded.last_payment_id;

  return jsonb_build_object(
    'success', true,
    'already_paid', false,
    'expires_at', v_expires_at,
    'product_name', v_product_name
  );
end;
$$;

revoke all on function public.activate_subject_purchase(text, text, uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.activate_subject_purchase(text, text, uuid, integer, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;
