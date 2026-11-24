-- Fix admin Subjects page: older deployed databases may be missing subjects.sort_order.
begin;

alter table public.subjects
  add column if not exists sort_order integer not null default 0;

create index if not exists subjects_sort_order_idx
  on public.subjects(sort_order);

notify pgrst, 'reload schema';

commit;
