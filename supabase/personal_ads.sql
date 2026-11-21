-- User-managed personal sponsored campaigns (separate from Google AdSense).
create table if not exists public.personal_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 90),
  description text check (description is null or char_length(description) <= 240),
  image_url text,
  destination_url text not null,
  button_text text default 'Learn more',
  placement text not null check (placement in ('home_hero','article_inline','study_material_end','result_below','footer')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','active','paused')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_ad_campaign_dates check (ends_at > starts_at)
);
create index if not exists personal_ad_campaign_active_idx
  on public.personal_ad_campaigns (placement, status, starts_at, ends_at);

create table if not exists public.personal_ad_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.personal_ad_campaigns(id) on delete cascade,
  placement text not null check (placement in ('home_hero','article_inline','study_material_end','result_below','footer')),
  clicked_at timestamptz not null default now()
);
create index if not exists personal_ad_clicks_campaign_idx on public.personal_ad_clicks(campaign_id, clicked_at desc);

alter table public.personal_ad_campaigns enable row level security;
alter table public.personal_ad_clicks enable row level security;

drop policy if exists "public can view active personal campaigns" on public.personal_ad_campaigns;
create policy "public can view active personal campaigns" on public.personal_ad_campaigns
for select to anon, authenticated using (status='active' and starts_at <= now() and ends_at >= now());

drop policy if exists "admins manage personal campaigns" on public.personal_ad_campaigns;
create policy "admins manage personal campaigns" on public.personal_ad_campaigns
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin','finance_manager')))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin','finance_manager')));

drop policy if exists "public can record personal ad clicks" on public.personal_ad_clicks;
create policy "public can record personal ad clicks" on public.personal_ad_clicks
for insert to anon, authenticated with check (
  exists (select 1 from public.personal_ad_campaigns c where c.id=campaign_id and c.status='active'
    and c.starts_at <= now() and c.ends_at >= now() and c.placement=placement)
);

drop policy if exists "admins view personal ad clicks" on public.personal_ad_clicks;
create policy "admins view personal ad clicks" on public.personal_ad_clicks
for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin','finance_manager'))
);
