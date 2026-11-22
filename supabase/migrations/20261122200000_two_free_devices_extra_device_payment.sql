-- Allow two free devices per student, then one-time INR 19 payment per extra device.
begin;

alter table public.student_device_bindings
  drop constraint if exists student_device_bindings_pkey;
alter table public.student_device_bindings
  add constraint student_device_bindings_pkey primary key (user_id, device_id);

create table if not exists public.student_device_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount_paise integer not null default 1900 check (amount_paise = 1900),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'created' check (status in ('created','paid','failed')),
  payment_signature text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  consumed_at timestamptz
);
create index if not exists student_device_payments_user_idx
  on public.student_device_payments(user_id, status);
alter table public.student_device_payments enable row level security;
revoke all on public.student_device_payments from anon, authenticated;
grant all on public.student_device_payments to service_role;

create or replace function public.claim_student_device_v2(p_user_id uuid, p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_paid_payment uuid;
begin
  if p_user_id is null or p_device_id is null then
    return jsonb_build_object('allowed', false, 'reason', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if exists (
    select 1 from public.student_device_bindings
    where user_id = p_user_id and device_id = p_device_id
  ) then
    update public.student_device_bindings
      set last_seen_at = now()
      where user_id = p_user_id and device_id = p_device_id;
    return jsonb_build_object('allowed', true, 'already_registered', true);
  end if;

  select count(*) into v_count
    from public.student_device_bindings where user_id = p_user_id;

  if v_count < 2 then
    insert into public.student_device_bindings(user_id, device_id)
      values (p_user_id, p_device_id);
    return jsonb_build_object('allowed', true, 'free_device', true);
  end if;

  select id into v_paid_payment
    from public.student_device_payments
    where user_id = p_user_id
      and device_id = p_device_id
      and status = 'paid'
      and consumed_at is null
    order by paid_at asc
    limit 1
    for update;

  if v_paid_payment is null then
    return jsonb_build_object('allowed', false, 'payment_required', true, 'price_paise', 1900);
  end if;

  update public.student_device_payments
    set consumed_at = now()
    where id = v_paid_payment;

  insert into public.student_device_bindings(user_id, device_id)
    values (p_user_id, p_device_id);

  return jsonb_build_object('allowed', true, 'paid_device', true);
end;
$$;

revoke all on function public.claim_student_device_v2(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_student_device_v2(uuid, uuid) to service_role;

-- Keep the original RPC compatible with any older application code.
create or replace function public.claim_student_device(p_user_id uuid, p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  result := public.claim_student_device_v2(p_user_id, p_device_id);
  return coalesce((result->>'allowed')::boolean, false);
end;
$$;
revoke all on function public.claim_student_device(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_student_device(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
commit;
