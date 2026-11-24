-- Student feedback survey and 3-day subject access reward
create table if not exists public.student_feedback_surveys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  overall_rating integer not null check (overall_rating between 1 and 5),
  ease_rating integer not null check (ease_rating between 1 and 5),
  recommendation integer not null check (recommendation between 0 and 10),
  favorite_feature text not null,
  improvement text,
  testimonial text,
  testimonial_consent boolean not null default false,
  reward_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists student_feedback_surveys_created_idx
  on public.student_feedback_surveys(created_at desc);
alter table public.student_feedback_surveys enable row level security;
-- Read/write through authenticated server APIs only.
