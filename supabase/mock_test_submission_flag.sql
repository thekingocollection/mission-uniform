-- Add submission state for server-graded attempts. Safe and additive.
alter table public.test_attempts
 add column if not exists is_submitted boolean not null default false;
