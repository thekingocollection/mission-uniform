-- MISSION UNIFORM OP: secure student support desk
create extension if not exists pgcrypto;

create sequence if not exists public.support_ticket_number_seq;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null default (
    'MU-' || to_char(now() at time zone 'UTC','YY') || '-' ||
    lpad(nextval('public.support_ticket_number_seq')::text, 6, '0')
  ),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 5 and 140),
  category text not null default 'General' check (category in ('Account','Mock Test','Results','Payment','Technical','Content Correction','General')),
  description text not null check (char_length(trim(description)) between 15 and 5000),
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','waiting_student','resolved','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 5000),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_updated_idx on public.support_tickets(status, updated_at desc);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id, created_at asc);

create or replace function public.support_touch_ticket()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.support_tickets
  set updated_at = now(),
      resolved_at = case when new.status = 'resolved' then coalesce(resolved_at, now()) else null end
  where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_message_touch_ticket on public.support_messages;
create trigger support_message_touch_ticket after insert on public.support_messages
for each row execute function public.support_touch_ticket();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_ticket_read_own_or_admin" on public.support_tickets;
create policy "support_ticket_read_own_or_admin" on public.support_tickets
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_blocked = false and p.role = 'super_admin'
  )
);

drop policy if exists "support_ticket_create_own" on public.support_tickets;
create policy "support_ticket_create_own" on public.support_tickets
for insert to authenticated with check (
  user_id = auth.uid()
  and status = 'open'
  and priority in ('normal','high','urgent')
);

drop policy if exists "support_ticket_admin_update" on public.support_tickets;
create policy "support_ticket_admin_update" on public.support_tickets
for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked = false and p.role = 'super_admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked = false and p.role = 'super_admin')
);

drop policy if exists "support_message_read_related" on public.support_messages;
create policy "support_message_read_related" on public.support_messages
for select to authenticated using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and (
      t.user_id = auth.uid() or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked = false and p.role = 'super_admin'
      )
    )
  )
);

drop policy if exists "support_message_insert_related" on public.support_messages;
create policy "support_message_insert_related" on public.support_messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and (
    (is_admin = false and exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid() and t.status not in ('closed','resolved')
    ))
    or
    (is_admin = true and exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.is_blocked = false and p.role = 'super_admin'
    ))
  )
);

grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant usage, select on sequence public.support_ticket_number_seq to authenticated;
notify pgrst, 'reload schema';

create or replace function public.support_set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists support_ticket_set_updated_at on public.support_tickets;
create trigger support_ticket_set_updated_at before update on public.support_tickets
for each row execute function public.support_set_updated_at();
