-- MISSION UNIFORM OP Complete Upgrade: run AFTER schema.sql, adsense.sql and personal_ads.sql.
-- Review the policies before production and enable Supabase Auth email/phone verification.

-- Student display names: use a public alias, never expose phone/email in rankings.
alter table public.profiles add column if not exists public_display_name text;
update public.profiles set public_display_name = coalesce(nullif(public_display_name,''), 'Student') where public_display_name is null;

-- Government job alerts: only published records are visible to the public.
create table if not exists public.job_alerts (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 organization text not null,
 location text not null default 'India',
 employment_type text not null default 'Government',
 qualification text,
 last_date date,
 official_url text not null,
 description text,
 is_verified boolean not null default false,
 is_published boolean not null default false,
 created_by uuid references public.profiles(id),
 published_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 constraint job_alerts_official_url_check check (official_url ~ '^https://')
);
create index if not exists job_alerts_published_idx on public.job_alerts(is_published,published_at desc);
alter table public.job_alerts enable row level security;
drop policy if exists "published job alerts public read" on public.job_alerts;
create policy "published job alerts public read" on public.job_alerts for select using (is_published=true);
drop policy if exists "admins manage job alerts" on public.job_alerts;
create policy "admins manage job alerts" on public.job_alerts for all to authenticated
 using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')))
 with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','super_admin')));

-- WhatsApp preferences are private; only the account owner can read/update their subscription.
create table if not exists public.whatsapp_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 phone text not null,
 topics text[] not null default array['daily_test']::text[],
 consent_at timestamptz not null,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint whatsapp_phone_digits check (phone ~ '^91[6-9][0-9]{9}$'),
 constraint whatsapp_topics_allowed check (topics <@ array['daily_test','job_alerts','weekly_results']::text[])
);
alter table public.whatsapp_subscriptions enable row level security;
drop policy if exists "students read own whatsapp preference" on public.whatsapp_subscriptions;
create policy "students read own whatsapp preference" on public.whatsapp_subscriptions for select to authenticated using (auth.uid()=user_id);
drop policy if exists "students update own whatsapp preference" on public.whatsapp_subscriptions;
create policy "students update own whatsapp preference" on public.whatsapp_subscriptions for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
-- Inserts are performed by the server route after verifying the Supabase access token and consent.
revoke all on public.whatsapp_subscriptions from anon, authenticated;
grant select, update on public.whatsapp_subscriptions to authenticated;

-- Public aggregate only: never return email, phone, user UUID, or raw answers.
create or replace function public.get_public_leaderboard(p_period text default 'weekly')
returns table(rank bigint, full_name text, points numeric, tests bigint, accuracy numeric)
language plpgsql stable security definer set search_path=public as $$
begin
 if p_period not in ('daily','weekly','all_time') then raise exception 'Invalid period'; end if;
 return query
 with filtered as (
  select a.user_id, sum(a.score)::numeric as total_points, count(*)::bigint as test_count,
   case when sum(a.correct_count+a.wrong_count)>0 then (sum(a.correct_count)::numeric*100/sum(a.correct_count+a.wrong_count)) else 0 end as acc
  from public.attempts a
  where a.submitted_at is not null
   and (p_period='all_time' or (p_period='daily' and a.submitted_at >= date_trunc('day',now())) or (p_period='weekly' and a.submitted_at >= date_trunc('week',now())))
  group by a.user_id
 )
 select row_number() over(order by f.total_points desc, f.acc desc, f.test_count desc)::bigint,
  coalesce(nullif(p.public_display_name,''), 'Student')::text, f.total_points, f.test_count, round(f.acc,1)
 from filtered f join public.profiles p on p.id=f.user_id
 order by f.total_points desc, f.acc desc, f.test_count desc limit 100;
end; $$;
revoke all on function public.get_public_leaderboard(text) from public;
grant execute on function public.get_public_leaderboard(text) to anon, authenticated;

-- Important: do not expose correct_option in student-facing question queries before submission.
-- Keep grading server-side in a separate authenticated RPC/API before enabling live exams.

-- Basic per-user AI usage counter: 30 prompts per rolling 24 hours.
create table if not exists public.ai_assistant_usage (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists ai_assistant_usage_user_time_idx on public.ai_assistant_usage(user_id,created_at desc);
alter table public.ai_assistant_usage enable row level security;
revoke all on public.ai_assistant_usage from anon, authenticated;

-- Automatically create a student profile when Supabase Auth creates a user.
create or replace function public.handle_new_muop_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,public_display_name,preferred_language,role)
 values(new.id, coalesce(new.raw_user_meta_data->>'full_name','Student'), 'Student', 'hi', 'student')
 on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_muop on auth.users;
create trigger on_auth_user_created_muop after insert on auth.users
 for each row execute procedure public.handle_new_muop_user();

-- Security hardening for the original starter schema.
-- Authenticated clients must not assign themselves privileged roles.
create or replace function public.prevent_student_role_escalation()
returns trigger language plpgsql as $$
begin
 if auth.uid() is not null and new.role is distinct from old.role then
  raise exception 'Profile role cannot be changed by the account owner';
 end if;
 return new;
end; $$;
drop trigger if exists prevent_student_role_escalation_trigger on public.profiles;
create trigger prevent_student_role_escalation_trigger before update on public.profiles
 for each row execute procedure public.prevent_student_role_escalation();

-- The starter's client-side attempt insert policy permits forged scores.
-- Disable direct client writes until a server-side grading endpoint/RPC is deployed.
drop policy if exists "attempts own insert" on public.attempts;
revoke insert, update, delete on public.attempts from anon, authenticated;
grant all on public.attempts to service_role;
grant all on public.ai_assistant_usage to service_role;
grant all on public.whatsapp_subscriptions to service_role;
