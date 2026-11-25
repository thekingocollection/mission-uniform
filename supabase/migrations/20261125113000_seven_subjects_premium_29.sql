-- Configure all seven student subjects as ₹29 premium access.
-- Uses the actual subjects schema: name_en, name_hi, name_or, slug, is_active.
-- Safe to rerun: existing subjects are retained and missing slugs are filled.
with desired_subjects(name_en, name_hi, name_or, slug) as (
  values
    ('Odia Grammar', 'Odia Grammar', 'ଓଡ଼ିଆ ବ୍ୟାକରଣ', 'odia-grammar'),
    ('English Grammar', 'English Grammar', 'ଇଂରାଜୀ ବ୍ୟାକରଣ', 'english-grammar'),
    ('General Knowledge', 'General Knowledge', 'ସାଧାରଣ ଜ୍ଞାନ', 'general-knowledge'),
    ('Quantitative Aptitude', 'Quantitative Aptitude', 'ଗଣିତ', 'quantitative-aptitude'),
    ('Reasoning', 'Reasoning', 'ଯୁକ୍ତିତର୍କ', 'reasoning'),
    ('Basic Computer Literacy', 'Basic Computer Literacy', 'ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ', 'basic-computer-literacy'),
    ('Previous Year Questions', 'Previous Year Questions', 'ପୂର୍ବବର୍ଷର ପ୍ରଶ୍ନ', 'previous-year-questions')
),
updated_existing as (
  update public.subjects s
  set slug = coalesce(nullif(trim(s.slug), ''), d.slug),
      is_active = true
  from desired_subjects d
  where lower(trim(s.name_en)) = lower(trim(d.name_en))
  returning s.id
),
inserted as (
  insert into public.subjects (name_en, name_hi, name_or, slug, is_active)
  select d.name_en, d.name_hi, d.name_or, d.slug, true
  from desired_subjects d
  where not exists (
    select 1 from public.subjects s
    where lower(trim(s.name_en)) = lower(trim(d.name_en))
  )
  returning id
),
all_subject_ids as (
  select s.id
  from public.subjects s
  join desired_subjects d
    on lower(trim(s.name_en)) = lower(trim(d.name_en))
  where s.is_active = true
  union
  select id from updated_existing
  union
  select id from inserted
)
insert into public.subject_access_settings (subject_id, price_paise, duration_days, is_enabled)
select id, 2900, null, true
from all_subject_ids
on conflict (subject_id) do update
set price_paise = excluded.price_paise,
    is_enabled = true;
