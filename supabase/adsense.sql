-- Smart, non-intrusive AdSense placement settings.
-- Run after the existing Mission Uniform OP schema.sql.
create table if not exists public.ad_placement_settings (
  placement text primary key check (placement in ('home_hero','article_inline','study_material_end','result_below','footer')),
  enabled boolean not null default true,
  slot_id text,
  global_enabled boolean not null default false,
  max_ads_per_page integer not null default 3 check (max_ads_per_page between 0 and 5),
  updated_at timestamptz not null default now()
);
alter table public.ad_placement_settings enable row level security;

drop policy if exists "public can read ad placement config" on public.ad_placement_settings;
create policy "public can read ad placement config" on public.ad_placement_settings
for select to anon, authenticated using (true);

drop policy if exists "admins manage ad placement config" on public.ad_placement_settings;
create policy "admins manage ad placement config" on public.ad_placement_settings
for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin','finance_manager')))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin','finance_manager')));

insert into public.ad_placement_settings(placement,enabled,slot_id,global_enabled,max_ads_per_page) values
('home_hero',true,null,false,3),
('article_inline',true,null,false,3),
('study_material_end',true,null,false,3),
('result_below',true,null,false,3),
('footer',true,null,false,3)
on conflict (placement) do nothing;
