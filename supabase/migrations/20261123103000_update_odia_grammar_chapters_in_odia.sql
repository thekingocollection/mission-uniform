-- Set the official Odia Grammar syllabus chapters in Odia.
-- Existing chapter rows and questions are preserved; outdated official chapters are hidden, not deleted.

do $$
declare
  v_subject_id uuid;
  v_names text[] := array[
    'ଶବ୍ଦ',
    'ଲିଙ୍ଗ, ବଚନ, ପୁରୁଷ',
    'ବିଶେଷ୍ୟ',
    'ବିଶେଷଣ',
    'ସର୍ବନାମ',
    'ପ୍ରତ୍ୟୟ',
    'କ୍ରିୟାବିଶେଷଣ ଶବ୍ଦ',
    'ସମୋଚ୍ଚାରିତ ଭିନ୍ନାର୍ଥକ ଶବ୍ଦ',
    'ଅନେକାର୍ଥବୋଧକ ଶବ୍ଦ',
    'କାଳ ଓ ବିଭକ୍ତି',
    'ଅବ୍ୟୟ',
    'ଉପସର୍ଗ',
    'କ୍ରିୟା',
    'ଶୁଦ୍ଧ ବାକ୍ୟ ଓ ଅଶୁଦ୍ଧ ବାକ୍ୟ',
    'ସନ୍ଧି',
    'ସମାସ',
    'ତଦ୍ଭବ',
    'ତତ୍ସମ',
    'ପଦ ପରିବର୍ତ୍ତନ',
    'ବାକ୍ୟ',
    'ପ୍ରତ୍ୟୟଯୋଗ ଓ ପ୍ରତ୍ୟୟାନ୍ତ',
    'କ୍ରିୟାର ବାଚ୍ୟ',
    'ରୂଢ଼ି ପ୍ରୟୋଗ',
    'ଲୋକବାଣୀ',
    'ସାଧାରଣ ଅଶୁଦ୍ଧି',
    'ଶବ୍ଦ ପରିବର୍ତ୍ତନର ଅର୍ଥବୋଧ'
  ];
  v_name text;
  v_index integer;
begin
  select id into v_subject_id
  from public.subjects
  where lower(coalesce(name_en, '')) in ('odia grammar', 'odia language')
     or lower(coalesce(name_hi, '')) in ('odia grammar', 'odia language')
     or coalesce(name_or, '') = 'ଓଡ଼ିଆ ବ୍ୟାକରଣ'
  order by case when lower(coalesce(name_en, '')) = 'odia grammar' then 0 else 1 end
  limit 1;

  if v_subject_id is null then
    raise exception 'Odia Grammar subject not found in public.subjects. Create/activate it before running this migration.';
  end if;

  update public.subjects
  set name_or = 'ଓଡ଼ିଆ ବ୍ୟାକରଣ'
  where id = v_subject_id;

  -- Preserve old chapters and their questions, but hide outdated official entries.
  update public.chapters
  set is_active = false
  where subject_id = v_subject_id
    and coalesce(is_official, false) = true
    and not (name = any(v_names));

  for v_index in 1..array_length(v_names, 1) loop
    v_name := v_names[v_index];

    if exists (
      select 1 from public.chapters
      where subject_id = v_subject_id and name = v_name
    ) then
      update public.chapters
      set is_active = true,
          is_official = true,
          syllabus_source = 'Odia Grammar syllabus supplied by admin',
          sort_order = v_index
      where subject_id = v_subject_id and name = v_name;
    else
      insert into public.chapters
        (subject_id, name, sort_order, is_active, is_official, syllabus_source)
      values
        (v_subject_id, v_name, v_index, true, true, 'Odia Grammar syllabus supplied by admin');
    end if;
  end loop;
end $$;
