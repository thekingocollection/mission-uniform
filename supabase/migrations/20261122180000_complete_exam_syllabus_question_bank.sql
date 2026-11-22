-- Seed the complete MISSION UNIFORM OP subject-wise syllabus into the
-- same subjects/chapters tables used by Admin > Question Bank.
-- Safe to run more than once: existing subjects and chapter names are retained.

do $$
declare
  s_odia uuid;
  s_english uuid;
  s_gk uuid;
  s_math uuid;
  s_reasoning uuid;
  s_computer uuid;
begin
  select id into s_odia from public.subjects where lower(name_en) = lower('Odia Grammar') limit 1;
  if s_odia is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('Odia Grammar', 'ଓଡ଼ିଆ ବ୍ୟାକରଣ', true) returning id into s_odia;
  else
    update public.subjects set is_active = true where id = s_odia;
  end if;

  select id into s_english from public.subjects where lower(name_en) = lower('English Grammar') limit 1;
  if s_english is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('English Grammar', 'English Grammar', true) returning id into s_english;
  else
    update public.subjects set is_active = true where id = s_english;
  end if;

  select id into s_gk from public.subjects where lower(name_en) = lower('General Knowledge') limit 1;
  if s_gk is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('General Knowledge', 'General Knowledge', true) returning id into s_gk;
  else
    update public.subjects set is_active = true where id = s_gk;
  end if;

  select id into s_math from public.subjects where lower(name_en) = lower('Quantitative Aptitude') limit 1;
  if s_math is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('Quantitative Aptitude', 'Quantitative Aptitude', true) returning id into s_math;
  else
    update public.subjects set is_active = true where id = s_math;
  end if;

  select id into s_reasoning from public.subjects where lower(name_en) = lower('Reasoning') limit 1;
  if s_reasoning is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('Reasoning', 'Reasoning', true) returning id into s_reasoning;
  else
    update public.subjects set is_active = true where id = s_reasoning;
  end if;

  select id into s_computer from public.subjects where lower(name_en) = lower('Basic Computer Literacy') limit 1;
  if s_computer is null then
    insert into public.subjects (name_en, name_hi, is_active)
    values ('Basic Computer Literacy', 'Basic Computer Literacy', true) returning id into s_computer;
  else
    update public.subjects set is_active = true where id = s_computer;
  end if;

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_odia, v.name, true, v.ord from (values
    (1,'ଶବ୍ଦ'),(2,'ଲିଙ୍ଗ, ବଚନ, ପୁରୁଷ'),(3,'ବିଶେଷ୍ୟ'),(4,'ବିଶେଷଣ'),(5,'ସର୍ବନାମ'),
    (6,'ପ୍ରତ୍ୟୟ'),(7,'କ୍ରିୟାବିଶେଷଣ ଶବ୍ଦ'),(8,'ସମୋଚ୍ଚାରିତ ଭିନ୍ନାର୍ଥକ ଶବ୍ଦ'),
    (9,'ଅନେକାର୍ଥବୋଧକ ଶବ୍ଦ'),(10,'କାଳ ଓ ବିଭକ୍ତି'),(11,'ଅବ୍ୟୟ'),(12,'ଉପସର୍ଗ'),
    (13,'କ୍ରିୟା'),(14,'ଶୁଦ୍ଧ ବାକ୍ୟ ଓ ଅଶୁଦ୍ଧ ବାକ୍ୟ'),(15,'ସନ୍ଧି'),(16,'ସମାସ'),
    (17,'ତଦ୍ଭବ'),(18,'ତତ୍ସମ'),(19,'ପଦ ପରିବର୍ତ୍ତନ'),(20,'ବାକ୍ୟ'),
    (21,'ପ୍ରତ୍ୟୟଯୋଗ ଓ ପ୍ରତ୍ୟୟାନ୍ତ'),(22,'କ୍ରିୟାର ବାଚ୍ୟ'),(23,'ରୂଢ଼ି ପ୍ରୟୋଗ'),
    (24,'ଲୋକବାଣୀ'),(25,'ସାଧାରଣ ଅଶୁଦ୍ଧି'),(26,'ଶବ୍ଦ ପରିବର୍ତ୍ତନର ଅର୍ଥବୋଧ')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_odia and lower(c.name)=lower(v.name));

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_english, v.name, true, v.ord from (values
    (1,'Vocabulary'),(2,'Synonyms and Antonyms'),(3,'One-word Substitution'),(4,'Idioms and Phrases'),
    (5,'Grammar and Usage'),(6,'Articles and Determiners'),(7,'Prepositions'),(8,'Tenses'),
    (9,'Subject-Verb Agreement'),(10,'Active and Passive Voice'),(11,'Direct and Indirect Speech'),
    (12,'Sentence Correction'),(13,'Error Detection'),(14,'Rearrangement of Sentences'),(15,'Comprehension')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_english and lower(c.name)=lower(v.name));

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_gk, v.name, true, v.ord from (values
    (1,'Current Affairs'),(2,'History'),(3,'Geography'),(4,'Polity'),(5,'Economy'),(6,'General Science')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_gk and lower(c.name)=lower(v.name));

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_math, v.name, true, v.ord from (values
    (1,'Number System'),(2,'Simplification'),(3,'Decimals and Fractions'),(4,'HCF and LCM'),
    (5,'Percentage'),(6,'Ratio and Proportion'),(7,'Average'),(8,'Profit and Loss'),
    (9,'Simple Interest'),(10,'Mensuration'),(11,'Time and Work'),(12,'Time, Speed and Distance'),
    (13,'Data Interpretation')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_math and lower(c.name)=lower(v.name));

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_reasoning, v.name, true, v.ord from (values
    (1,'Analogy'),(2,'Classification'),(3,'Series'),(4,'Coding-Decoding'),(5,'Blood Relations'),
    (6,'Direction Sense'),(7,'Order and Ranking'),(8,'Pattern Recognition'),(9,'Figure Analogy'),
    (10,'Figure Classification'),(11,'Mirror and Water Images')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_reasoning and lower(c.name)=lower(v.name));

  insert into public.chapters (subject_id, name, is_active, sort_order)
  select s_computer, v.name, true, v.ord from (values
    (1,'Basics of Computers'),(2,'Computer Hardware and Software'),(3,'Operating Systems'),
    (4,'Input and Output Devices'),(5,'MS Office Basics'),(6,'Internet and E-mail'),
    (7,'Digital Payment Systems'),(8,'Cyber Safety'),(9,'Social Media Awareness'),
    (10,'Basic Government Digital Services')
  ) as v(ord,name)
  where not exists (select 1 from public.chapters c where c.subject_id=s_computer and lower(c.name)=lower(v.name));
end $$;
