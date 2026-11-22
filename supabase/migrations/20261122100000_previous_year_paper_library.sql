-- Previous-year PDF archive managed from the admin panel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('previous-year-papers', 'previous-year-papers', true, 20971520, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = 20971520, allowed_mime_types = array['application/pdf'];

create table if not exists public.previous_year_papers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  exam_name text not null,
  exam_year integer not null check (exam_year between 2000 and 2100),
  session_label text,
  description text,
  source_label text,
  pdf_path text not null,
  pdf_url text not null,
  pdf_file_name text not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists previous_year_papers_status_year_idx
  on public.previous_year_papers(status, exam_year desc, created_at desc);

alter table public.previous_year_papers enable row level security;

drop policy if exists "Public can read published previous year papers" on public.previous_year_papers;
create policy "Public can read published previous year papers"
  on public.previous_year_papers for select
  using (status = 'published');

drop policy if exists "Admins manage previous year paper files" on storage.objects;
create policy "Admins manage previous year paper files"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'previous-year-papers'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  )
  with check (
    bucket_id = 'previous-year-papers'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin')
  );
