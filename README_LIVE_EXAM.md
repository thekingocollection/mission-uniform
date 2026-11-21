# Live exam setup

1. In Supabase SQL Editor, run `schema.sql` if not already run.
2. Run `live_exam_upgrade.sql`.
3. Run `seed.sql` if you want the initial subjects.
4. Promote your own trusted account to super_admin from SQL Editor:
   `update public.profiles set role='super_admin' where id='YOUR_AUTH_USER_UUID';`
5. Sign out/in again, open `/admin/questions`, create questions and mark them Published.

## Connected flow
- Student test page fetches published questions from `public.public_questions`.
- The public view omits `correct_index`, so answers are not sent to the student browser.
- On submission, `submit_mock_attempt` grades against the private questions table inside PostgreSQL and inserts an attempt for `auth.uid()`.
- `/test-history` reads attempts allowed by the user's RLS policy.
- `/admin/questions` supports adding, publishing/unpublishing and deleting MCQs. Admin writes require `staff_admin` or `super_admin`.
- Demo questions remain as fallback when no published database questions exist.

This is a development upgrade. Test it with a non-production account before launch and verify the SQL migration succeeds.

## V2 Super Admin Control Centre
- Admin login: `/admin/login` (email/password Supabase Auth; separate from student OTP login).
- Admin dashboard: `/admin`.
- Apply `supabase/admin_v2_migration.sql` after database backup.
- Follow `supabase/ADMIN_V2_SETUP.md` to promote your own profile to `super_admin`.
- Only `super_admin` is authorized in the V2 admin UI and RLS policies. Student self-service profile updates cannot change `role` or `is_blocked`.
- The V2 migration preserves the live `questions` and `attempts` column names provided for this project; it does not rerun `schema.sql`.
- Student management, subjects, chapters, tests, job alerts, notifications and settings are Supabase-backed. The settings module stores configuration; public pages must read each setting before it changes their behaviour.
