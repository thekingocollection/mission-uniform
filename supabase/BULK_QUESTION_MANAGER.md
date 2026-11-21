# MISSION UNIFORM OP — Bulk Question Manager

This feature targets the existing `public.questions` columns confirmed for this project:

- `subject_id` (uuid), `chapter` (text)
- `question_hi`, `question_or`, `question_en` (text)
- `options` (jsonb array of four strings)
- `correct_option` (text: A/B/C/D)
- `explanation_hi`, `explanation_or`, `explanation_en` (text)
- `difficulty` (text), `source_note` (text)
- `verified` (boolean), `is_active` (boolean), `created_at`

## Install and run

From the project root:

```bash
npm install
npm run dev
```

Open `/admin/questions` after signing in with an account whose `profiles.role` is `admin`, `staff_admin`, or `super_admin`.

## Import format

Download the Excel or CSV template from the page. The first row must contain these headers:

`subject_id, chapter, question_hi, question_or, question_en, option_a, option_b, option_c, option_d, correct_option, explanation_hi, explanation_or, explanation_en, difficulty, source_note, verified, is_active`

- `question_hi` and all four options are required.
- `correct_option`: A/B/C/D (also accepts 1/2/3/4).
- `subject_id`: a real UUID from `public.subjects`, or select a default subject in the UI.
- `difficulty`: easy, medium, hard.
- `verified` and `is_active`: true/false. Defaults are false and true respectively.
- Maximum 100 data rows and 2 MB per file.
- Rows failing validation are not inserted.

## Security

The page checks the signed-in user's `profiles.role` before displaying the import UI. This is a UI gate, not a replacement for database security. Keep RLS enabled on `public.questions` and ensure only trusted admin roles can INSERT/UPDATE/DELETE. Never expose a Supabase service-role key in browser code.

Example admin-only insert policy if your project does not already have an equivalent policy (review against existing policies before running):

```sql
alter table public.questions enable row level security;
drop policy if exists "admins insert questions" on public.questions;
create policy "admins insert questions" on public.questions
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'staff_admin', 'super_admin')
  )
);
```

Do not add a broad `to authenticated with check (true)` policy. If your existing admin RLS policy already authorizes writes, no extra policy is needed.
