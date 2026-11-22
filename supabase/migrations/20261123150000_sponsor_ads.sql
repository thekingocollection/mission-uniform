create table if not exists public.sponsor_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  target_url text not null,
  placement text not null default 'global_top' check (placement in ('global_top','dashboard_top','syllabus_top','below_content')),
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sponsor_ads_title_length check (char_length(title) between 1 and 100),
  constraint sponsor_ads_description_length check (description is null or char_length(description) <= 220)
);
create index if not exists sponsor_ads_active_placement_idx
  on public.sponsor_ads (is_active, placement, priority desc, created_at desc);
alter table public.sponsor_ads enable row level security;
drop policy if exists "Super admins manage sponsor ads" on public.sponsor_ads;
create policy "Super admins manage sponsor ads" on public.sponsor_ads
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin' and coalesce(p.is_blocked,false) = false))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin' and coalesce(p.is_blocked,false) = false));
grant select, insert, update, delete on public.sponsor_ads to authenticated;
grant select on public.sponsor_ads to anon;
