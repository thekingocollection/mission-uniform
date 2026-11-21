insert into public.subjects(slug,name,name_od,description,sort_order) values
('odisha-gk','Odisha GK','ଓଡ଼ିଶା ସାଧାରଣ ଜ୍ଞାନ','Odisha history, geography, culture and polity.',1),
('general-knowledge','General Knowledge','ସାଧାରଣ ଜ୍ଞାନ','India, world, science and current affairs.',2),
('reasoning','Reasoning','ଯୁକ୍ତିତର୍କ','Verbal and non-verbal reasoning.',3),
('mathematics','Mathematics','ଗଣିତ','Arithmetic and quantitative aptitude.',4),
('odia-grammar','Odia Grammar','ଓଡ଼ିଆ ବ୍ୟାକରଣ','Odia language and grammar.',5),
('english','English','ଇଂରାଜୀ','English grammar and vocabulary.',6)
on conflict(slug) do update set name=excluded.name,name_od=excluded.name_od,description=excluded.description;
