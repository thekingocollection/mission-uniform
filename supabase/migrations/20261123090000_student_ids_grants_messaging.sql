-- Unique student codes, complimentary subject access audit, and in-app messaging.
begin;

create sequence if not exists public.muop_student_code_seq start 1;

alter table public.profiles add column if not exists student_code text;

with numbered as (
  select id, row_number() over (order by created_at asc nulls last, id) as rn
  from public.profiles where student_code is null
)
update public.profiles p
set student_code = 'MUOP-' || to_char(coalesce(p.created_at, now()), 'YYYY') || '-' || lpad(n.rn::text, 6, '0')
from numbered n where p.id = n.id;

create unique index if not exists profiles_student_code_unique on public.profiles(student_code);

create or replace function public.assign_muop_student_code()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.student_code is null or btrim(new.student_code) = '' then
    new.student_code := 'MUOP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.muop_student_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_muop_student_code on public.profiles;
create trigger trg_assign_muop_student_code before insert on public.profiles
for each row execute function public.assign_muop_student_code();

create table if not exists public.student_access_grant_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  action text not null check (action in ('granted','revoked')),
  expires_at timestamptz,
  reason text,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists student_access_grant_audit_user_idx
  on public.student_access_grant_audit(user_id, created_at desc);

create table if not exists public.student_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  is_broadcast boolean not null default false,
  check (length(btrim(title)) between 1 and 120),
  check (length(btrim(body)) between 1 and 3000)
);
create index if not exists student_messages_user_created_idx
  on public.student_messages(user_id, created_at desc);
create index if not exists student_messages_broadcast_idx
  on public.student_messages(is_broadcast, created_at desc);

alter table public.student_access_grant_audit enable row level security;
alter table public.student_messages enable row level security;
revoke all on public.student_access_grant_audit, public.student_messages from anon, authenticated;
grant all on public.student_access_grant_audit, public.student_messages to service_role;

notify pgrst, 'reload schema';
commit;
