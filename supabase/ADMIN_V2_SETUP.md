# MISSION UNIFORM OP V2 — Admin setup

## 1. Back up first
In Supabase Dashboard → Database → Backups (or export the tables you need) before applying migrations.

## 2. Run migration
Open SQL Editor and run `admin_v2_migration.sql`.

## 3. Promote your own account (one-time)
Create your account first using Supabase Auth (email/password). Then run this SQL, replacing the email with the exact email used for that account:

```sql
update public.profiles p
set role = 'super_admin', is_blocked = false
from auth.users u
where p.id = u.id and lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

Confirm:
```sql
select p.id, u.email, p.role, p.is_blocked
from public.profiles p join auth.users u on u.id = p.id
where lower(u.email) = lower('YOUR_ADMIN_EMAIL@example.com');
```

The account must show `super_admin`. Do not share passwords, OTPs, anon keys, or service-role keys in chat.

## 4. Admin login
Open `/admin/login` and sign in using the email/password for the promoted account. Student phone OTP login remains at `/login`.

## 5. Existing schema compatibility
This migration does not rename or replace `questions` or `attempts` columns. The question manager uses your confirmed fields: `subject_id`, `chapter`, `question_hi`, `question_or`, `question_en`, `options`, `correct_option`, `explanation_hi`, `explanation_or`, `explanation_en`, `difficulty`, `source_note`, `verified`, `is_active`. Attempts are read using your current `user_id`, `mock_id`, `subject_test_id`, `answers`, `score`, `correct_count`, `wrong_count`, `skipped_count`, `started_at`, `submitted_at` fields.

If your `subjects` or `chapters` tables have different columns than the starter schema, inspect them before using those CRUD screens. Never run the original `schema.sql` over an existing live database.
