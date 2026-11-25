# MISSION UNIFORM OP — Subject Paid Access Setup

## Existing subject premium
- Admin-only Subject Monetization page: `/admin/monetization`.
- Default subject price: ₹29 (2,900 paise).
- Admin can configure each subject price and access duration (Lifetime, 1/7/30/90/180/365 days).
- Student catalogue shows purchase and expiry status.
- Razorpay order creation and server-side signature + captured-payment verification.
- Existing free tests outside the subject-random practice flow remain free.
- New students have a 24-hour trial for eligible subject practice, as enforced by the database migration.

## Required migrations

Back up the Supabase database first. Confirm which migrations have already been applied; do not blindly rerun older migrations out of order.

The subject monetization flow depends on:
1. `20261122130000_subject_paid_access.sql`
2. `20261122220000_student_24h_trial_access.sql`
3. `20261123120000_finance_report_purchase_snapshots.sql`
4. `20261125113000_seven_subjects_premium_29.sql`
5. `20261125150000_atomic_subject_purchase_activation.sql` (new: applies payment + entitlement in one database transaction and makes verified retries safe)

Run only migrations that are not yet applied, in chronological order, using Supabase SQL Editor. The new migration is additive and does not drop or rename existing tables.

## Render environment variables

- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay Key ID (public identifier).
- `RAZORPAY_KEY_SECRET` — Razorpay Key Secret (server-only; never use a `NEXT_PUBLIC_` prefix).
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only.

Use Razorpay Test Mode first. Switch to Live Mode only after test payments and entitlement/expiry/lock tests pass.

## Admin use

1. Sign in as Super Admin.
2. Open Admin → Subject Monetization.
3. Set each subject's price and duration.
4. Use Lock All / Unlock All or an individual subject switch.
5. Open Admin → Finance Report to inspect purchases and export Excel.

Only Super Admin can edit monetization controls. Staff roles are intentionally denied.

## Student use

1. Sign in and open Subject Wise Mock Test.
2. Choose a subject and pay the displayed amount.
3. Access activates only after the server verifies the Razorpay signature and confirms the payment is captured, linked to the order, and matches the expected INR amount.
4. Access duration is snapshotted at successful payment time.
5. Existing free tests remain available without purchasing a subject.

## Operational notes

- Payment verification and entitlement activation are atomic through the `activate_subject_purchase` database function. A retry after a transient response/database failure repairs access without double-crediting a different payment.
- Never expose `RAZORPAY_KEY_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- GitHub migration files do not prove that the live Supabase database has run them. Verify the migration in the actual Supabase project before enabling paid checkout.
- Do not announce paid access until Razorpay Test Mode, live Supabase schema, Render environment variables, and a real-device test are verified.
