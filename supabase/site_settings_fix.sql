-- MISSION UNIFORM OP: create the missing Website Settings table.
-- Safe to run on an existing project; does not overwrite saved settings.

begin;

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

-- Website settings can be read by the public site. Only Super Admin can change them.
drop policy if exists settings_public_read on public.site_settings;
drop policy if exists settings_super_all on public.site_settings;
drop policy if exists "public settings read" on public.site_settings;
drop policy if exists "admin settings write" on public.site_settings;

create policy settings_public_read
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

create policy settings_super_all
  on public.site_settings
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

-- Insert defaults only when a setting does not already exist.
insert into public.site_settings (key, value)
values
  ('site_name', to_jsonb('MISSION UNIFORM OP'::text)),
  ('tagline', to_jsonb('आपकी वर्दी, आपका सपना।'::text)),
  ('maintenance_mode', 'false'::jsonb),
  ('registration_enabled', 'true'::jsonb),
  ('daily_test_enabled', 'true'::jsonb),
  ('weekly_test_enabled', 'true'::jsonb),
  ('ads_enabled', 'false'::jsonb),
  ('announcement', to_jsonb(''::text))
on conflict (key) do nothing;

commit;

-- Refresh PostgREST schema cache so the website can discover the new table.
notify pgrst, 'reload schema';
