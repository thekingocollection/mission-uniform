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


-- Enforce access at the database boundary too, so students cannot bypass the API
-- by calling start_mock_test_attempt directly from the browser.
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
  if not found or (v_expires_at is not null and v_expires_at <= now()) then
    raise exception 'Unlock this subject to start its mock tests';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_subject_access_before_attempt on public.test_attempts;
create trigger trg_enforce_subject_access_before_attempt
before insert on public.test_attempts
for each row execute function public.enforce_subject_access_before_attempt();
