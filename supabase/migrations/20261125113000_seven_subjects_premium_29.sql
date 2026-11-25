-- Set all seven student subject tiles to ₹29 premium access.
-- Existing student access records are preserved; this only updates catalog pricing/availability.
with desired_subjects(name_en, name_hi, name_or, sort_order) as (
  values
    ('Odia Grammar', 'Odia Grammar', 'ଓଡ଼ିଆ ବ୍ୟାକରଣ', 1),
    ('English Grammar', 'English Grammar', 'ଇଂରାଜୀ ବ୍ୟାକରଣ', 2),
    ('General Knowledge', 'General Knowledge', 'ସାଧାରଣ ଜ୍ଞାନ', 3),
    ('Quantitative Aptitude', 'Quantitative Aptitude', 'ଗଣିତ', 4),
    ('Reasoning', 'Reasoning', 'ଯୁକ୍ତିତର୍କ', 5),
    ('Basic Computer Literacy', 'Basic Computer Literacy', 'ମୌଳିକ କମ୍ପ୍ୟୁଟର ଜ୍ଞାନ', 6),
    ('Previous Year Questions', 'Previous Year Questions', 'ପୂର୍ବବର୍ଷର ପ୍ରଶ୍ନ', 7)
),
inserted as (
  insert into public.subjects (name_en, name_hi, name_or, sort_order, is_active)
  select d.name_en, d.name_hi, d.name_or, d.sort_order, true
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
)
insert into public.subject_access_settings (subject_id, price_paise, duration_days, is_enabled)
select id, 2900, null, true
from all_subject_ids
on conflict (subject_id) do update
set price_paise = excluded.price_paise,
    is_enabled = true;

