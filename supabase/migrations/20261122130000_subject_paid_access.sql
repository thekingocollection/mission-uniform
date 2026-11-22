-- MISSION UNIFORM OP: Admin-controlled paid access for subject-wise mock tests.
begin;

create table if not exists public.subject_access_settings (
  subject_id uuid primary key references public.subjects(id) on delete cascade,
  price_paise integer not null default 2900 check (price_paise >= 0),
  duration_days integer null check (duration_days is null or duration_days > 0),
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.subject_access_global (
  singleton boolean primary key default true check (singleton),
  all_subjects_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.subject_access_global(singleton,all_subjects_enabled)
values(true,true) on conflict(singleton) do nothing;

create table if not exists public.student_subject_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz null,
  last_payment_id text,
  created_at timestamptz not null default now(),
  unique(user_id,subject_id)
);
create index if not exists student_subject_access_user_idx on public.student_subject_access(user_id);
create index if not exists student_subject_access_expiry_idx on public.student_subject_access(expires_at);

create table if not exists public.subject_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  amount_paise integer not null check(amount_paise > 0),
  currency text not null default 'INR',
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check(status in ('created','paid','failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists subject_payment_user_idx on public.subject_payment_transactions(user_id,created_at desc);

alter table public.subject_access_settings enable row level security;
alter table public.subject_access_global enable row level security;
alter table public.student_subject_access enable row level security;
alter table public.subject_payment_transactions enable row level security;

revoke all on public.subject_access_settings, public.subject_access_global,
  public.student_subject_access, public.subject_payment_transactions from anon, authenticated;
grant all on public.subject_access_settings, public.subject_access_global,
  public.student_subject_access, public.subject_payment_transactions to service_role;

-- Keep one settings row for every active subject. Existing subjects remain unlocked by default.
insert into public.subject_access_settings(subject_id)
select id from public.subjects
on conflict(subject_id) do nothing;

commit;
