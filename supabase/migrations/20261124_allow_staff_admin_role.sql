-- Allow the Staff Admin role used by the current admin workspace.
-- The deployed database had an older profiles_role_check constraint.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'staff_admin', 'super_admin'));

-- Staff module access is stored as a JSON permissions map.
alter table public.profiles
  add column if not exists permissions jsonb not null default '{}'::jsonb;
