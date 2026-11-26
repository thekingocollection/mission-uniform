-- Partner analytics and manual payout requests.
-- Existing partner, referral, commission and payout records remain unchanged.

create table if not exists public.partner_clicks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  visitor_key text not null,
  landing_path text not null default '/signup',
  created_at timestamptz not null default now(),
  unique(partner_id, visitor_key)
);
create index if not exists partner_clicks_partner_created_idx on public.partner_clicks(partner_id, created_at desc);

create table if not exists public.partner_payout_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount_paise bigint not null check(amount_paise > 0),
  payout_method text not null check(payout_method in ('upi','bank')),
  payout_details jsonb not null default '{}'::jsonb,
  note text,
  status text not null default 'requested' check(status in ('requested','approved','rejected','paid')),
  admin_note text,
  payment_reference text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  paid_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);
create index if not exists partner_payout_requests_partner_created_idx on public.partner_payout_requests(partner_id, requested_at desc);
create index if not exists partner_payout_requests_status_idx on public.partner_payout_requests(status, requested_at);

alter table public.partner_clicks enable row level security;
alter table public.partner_payout_requests enable row level security;
-- All access is through server routes after token and role verification.
grant all on public.partner_clicks, public.partner_payout_requests to service_role;


-- Complete a verified manual payout atomically to prevent duplicate ledger entries.
create or replace function public.complete_partner_payout_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_payment_reference text,
  p_admin_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.partner_payout_requests%rowtype;
  v_due bigint;
  v_now timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'super_admin' and coalesce(is_blocked,false) = false
  ) then
    raise exception 'Super Admin access required';
  end if;

  select * into v_request
  from public.partner_payout_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Payout request not found'; end if;
  if v_request.status <> 'approved' then raise exception 'Approve this payout request before marking it paid'; end if;
  if coalesce(trim(p_payment_reference),'') = '' then raise exception 'Verified payment reference is required'; end if;

  select coalesce(sum(commission_paise),0) into v_due
  from public.partner_commissions
  where partner_id = v_request.partner_id and status not in ('paid','reversed');

  if v_due <> v_request.amount_paise then
    raise exception 'Outstanding commission no longer matches this request. Refresh and reconcile before paying';
  end if;

  insert into public.partner_payouts(partner_id,amount_paise,payment_reference,notes,paid_by,paid_at)
  values(v_request.partner_id,v_request.amount_paise,trim(p_payment_reference),p_admin_note,p_admin_id,v_now);

  update public.partner_commissions
  set status = 'paid', paid_at = v_now
  where partner_id = v_request.partner_id and status not in ('paid','reversed');

  update public.partner_payout_requests
  set status = 'paid', payment_reference = trim(p_payment_reference),
      admin_note = p_admin_note, paid_at = v_now, reviewed_at = v_now, reviewed_by = p_admin_id
  where id = p_request_id;

  return jsonb_build_object('success',true,'request_id',p_request_id,'paid_at',v_now);
end;
$$;

revoke all on function public.complete_partner_payout_request(uuid,uuid,text,text) from public;
grant execute on function public.complete_partner_payout_request(uuid,uuid,text,text) to service_role;
