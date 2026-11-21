# MISSION UNIFORM OP

Royal navy / gold responsive exam-preparation portal starter using Next.js App Router, React and Supabase.

## Included
- Public home, about, subjects, subject detail pages, study material, previous papers, job alerts, notifications, contact, privacy and terms.
- Student login/signup with Supabase phone OTP UI, student dashboard, profile, test history, bookmarks, wrong-answer and performance pages.
- Daily, subject, chapter, full and grand mock-test routes. The included demo CBT has timer, question palette, answer selection, mark-for-review, clear, submit, score and explanations. Attempts are saved to browser local storage in demo mode.
- Admin navigation and module route placeholders for students, subjects, chapters, questions, tests, job alerts, notifications, ads, revenue and settings.
- Supabase schema, row-level security starter policies, profile trigger and subject seed data.
- `/api/health` health endpoint.

## Setup
1. Install Node.js 22 LTS.
2. Extract this folder and open it in VS Code.
3. Copy `.env.example` to `.env.local`.
4. Create a Supabase project. Put the project URL and anon/publishable key in `.env.local`.
5. In Supabase SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`.
6. In Supabase Authentication -> Providers -> Phone, enable SMS and configure a supported SMS provider. Never share OTPs or secret keys.
7. Run `npm install`, then `npm run dev`.
8. Open http://localhost:3000.

## Important implementation status
This is an integrated development starter, not a certified production release. The CBT demo currently uses bundled sample questions and browser-local attempt history; it is not yet pulling live question sets from Supabase or grading on a trusted server. Admin screens are route-complete UI placeholders; they do not yet implement full CRUD workflows. Secure admin role assignment must be performed manually by a trusted project owner in Supabase SQL, never by public signup. Job alert, notification, bookmark sync, revenue, AdSense and AI integrations need their respective backend workflows and credentials. Do not advertise them as live until tested.

To grant the first super admin after signing up, use the Supabase SQL editor and replace the UUID with the trusted account ID:

```sql
update public.profiles set role='super_admin' where id='YOUR_AUTH_USER_UUID';
```

## Routes
- `/` home
- `/subjects` and `/subjects/[slug]`
- `/tests`, `/tests/daily`, `/tests/subject?subject=Odisha%20GK`, `/tests/chapter?subject=Mathematics`, `/tests/full-mock`, `/tests/grand-test`
- `/login`, `/signup`, `/dashboard`, `/profile`, `/test-history`, `/bookmarks`, `/wrong-answers`, `/performance`, `/leaderboard`
- `/admin` and `/admin/*`
- `/api/health`

## Before public launch
- Implement server-verified grading and fetch only safe question fields to the browser.
- Complete admin CRUD with server-side role checks and audit logs.
- Add production auth redirects and protect student/admin routes with middleware/server checks.
- Add data export/deletion, rate limiting, backups, monitoring and security review.
- Verify all recruitment alerts against official sources; configure a privacy policy and consent requirements for analytics/ads.


## Live Supabase exam + admin question bank
After the existing `schema.sql` is installed, run `supabase/live_exam_upgrade.sql` in the Supabase SQL Editor. This enables the public safe question view, authenticated admin CRUD through RLS, and secure PostgreSQL grading into `attempts`. Read `README_LIVE_EXAM.md` for the exact setup and admin promotion steps.
