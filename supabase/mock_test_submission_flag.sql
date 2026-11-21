alter table public.test_attempts
  add column if not exists is_submitted boolean not null default false;
