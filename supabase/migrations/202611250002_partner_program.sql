-- Mission Uniform OP partner programme.
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  referral_code text unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','inactive')),
  commission_rate numeric(5,2) not null default 0 check (commission_rate >= 0 and commission_rate <= 100),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  student_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  referral_id uuid not null references public.partner_referrals(id) on delete cascade,
  payment_transaction_id uuid not null unique,
  amount_paise bigint not null default 0,
  commission_rate numeric(5,2) not null,
  commission_paise bigint not null default 0,
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  payment_reference text,
  notes text,
  paid_by uuid references public.profiles(id),
  paid_at timestamptz not null default now()
);

create index if not exists partner_referrals_partner_id_idx on public.partner_referrals(partner_id);
create index if not exists partner_commissions_partner_id_idx on public.partner_commissions(partner_id);
create index if not exists partners_status_idx on public.partners(status);

alter table public.partners enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_commissions enable row level security;
alter table public.partner_payouts enable row level security;
-- No direct client policies: all partner programme reads/writes use verified server routes.

create or replace function public.attach_partner_referral_to_new_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_code text;
declare v_partner_id uuid;
begin
  select upper(trim(coalesce(raw_user_meta_data->>'partner_referral_code','')))
    into v_code from auth.users where id = new.id;
  if v_code is null or v_code = '' then return new; end if;
  select id into v_partner_id from public.partners
    where upper(referral_code) = v_code and status = 'approved' limit 1;
  if v_partner_id is not null then
    insert into public.partner_referrals(partner_id, student_id)
    values(v_partner_id, new.id) on conflict(student_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_created_attach_partner on public.profiles;
create trigger on_profile_created_attach_partner
after insert on public.profiles
for each row execute function public.attach_partner_referral_to_new_profile();

create or replace function public.record_partner_premium_commission()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_referral public.partner_referrals%rowtype;
declare v_rate numeric(5,2);
begin
  if new.status in ('refunded','failed') then
    update public.partner_commissions set status = 'reversed'
      where payment_transaction_id = new.id and status <> 'paid';
    return new;
  end if;
  if new.status <> 'paid' or new.user_id is null or coalesce(new.amount_paise,0) <= 0 then
    return new;
  end if;
  select * into v_referral from public.partner_referrals
    where student_id = new.user_id limit 1;
  if not found then return new; end if;
  select commission_rate into v_rate from public.partners
    where id = v_referral.partner_id and status = 'approved';
  if v_rate is null or v_rate <= 0 then return new; end if;
  insert into public.partner_commissions(
    partner_id, referral_id, payment_transaction_id, amount_paise, commission_rate, commission_paise
  ) values (
    v_referral.partner_id, v_referral.id, new.id, new.amount_paise, v_rate,
    round(new.amount_paise * v_rate / 100.0)::bigint
  ) on conflict(payment_transaction_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_subject_payment_paid_partner_commission on public.subject_payment_transactions;
create trigger on_subject_payment_paid_partner_commission
after insert or update of status on public.subject_payment_transactions
for each row execute function public.record_partner_premium_commission();

grant all on public.partners, public.partner_referrals, public.partner_commissions, public.partner_payouts to service_role;
