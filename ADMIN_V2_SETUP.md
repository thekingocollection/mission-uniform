# MISSION UNIFORM OP — V2 Complete Super Admin

## Included
- Royal Navy + Gold responsive admin workspace
- Dedicated email/password Super Admin login at `/admin/login`
- Super Admin-only route gate and matching Supabase RLS migration
- Overview counts for profiles, subjects, questions, tests, attempts and job alerts
- Student directory with active/blocked status controls
- CRUD screens for subjects, chapters, mock tests, job alerts and notifications
- Website settings stored in `site_settings`
- Existing Bulk Question Manager retained and restricted to `super_admin`
- Admin audit-log table for future audited actions

## Install / upgrade
1. Extract this ZIP into a new folder; do not overwrite your only working copy.
2. Copy your existing `.env.local` into the project root (same folder as `package.json`).
3. Back up your Supabase database.
4. Run `supabase/admin_v2_migration.sql` in Supabase SQL Editor.
5. Create or confirm your dedicated administrator account in Supabase Authentication with Email/Password enabled.
6. Follow `supabase/ADMIN_V2_SETUP.md` to promote the exact account email to `super_admin`.
7. Start locally with `npm install` then `npm run dev`.
8. Open `http://localhost:3000/admin/login`.

## Important schema compatibility
The migration deliberately does not rename or recreate `questions` or `attempts`. The question bulk screen retains the actual question fields confirmed in the database: `chapter`, `question_hi`, `question_or`, `question_en`, `correct_option`, `explanation_hi`, `explanation_or`, `explanation_en`, `verified`, and `is_active`. It also retains `options` as JSONB. The attempts table is not altered.

The generic CRUD screens assume the other tables match the existing starter schema (`subjects`, `chapters`, `tests`, `job_alerts`, `notifications`, `site_settings`). If your live versions differ, inspect their columns before saving data from those screens.

## Security and limitations
- Never put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable or browser code.
- Only a profile with `role='super_admin'` can pass the admin gate and write via RLS.
- The first Super Admin is assigned manually through the SQL Editor; the public app has no self-promotion flow.
- Student block status is managed in `profiles.is_blocked`. Connect this flag to any additional custom student APIs or integrations you add later.
- Website settings are stored in Supabase. Public pages must read the corresponding setting for each switch to affect their runtime behaviour.
- Revenue analytics and external AdSense reporting are not part of this V2 scope.
- Build and live Supabase integration could not be verified in this environment. Test on a backup/staging Supabase project before production.
