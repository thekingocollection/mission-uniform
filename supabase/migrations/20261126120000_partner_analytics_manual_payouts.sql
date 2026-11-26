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
