# MISSION UNIFORM OP — Subject Paid Access Setup

## What is included
- Admin-only Subject Monetization page at `/admin/monetization`.
- Default subject price ₹29 (2900 paise).
- Admin controls each subject's price, access duration (Lifetime, 1/7/30/90/180/365 days), and individual lock.
- Global Lock All / Unlock All controls.
- Student subject catalogue with purchase and expiry status.
- Razorpay order creation and server-side signature/payment verification.
- Server API and database trigger enforce paid access before a subject-random mock test can start.

## Required Supabase migration
Run this file in Supabase SQL Editor after taking a database backup:

`supabase/migrations/20261122130000_subject_paid_access.sql`

## Required Render environment variables
Add these to the MISSION UNIFORM OP Render service:

- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay Key ID (public identifier).
- `RAZORPAY_KEY_SECRET` — Razorpay Key Secret (server-only; never add NEXT_PUBLIC_).
- Existing `NEXT_PUBLIC_SUPABASE_URL`
- Existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key)
- Existing `SUPABASE_SERVICE_ROLE_KEY` (server-only)

Use Razorpay Test Mode keys first. Switch to Live Mode only after completing test payments and verifying access/expiry/lock behaviour.

## Admin use
1. Sign in with the Super Admin account.
2. Open Admin → Subject Monetization.
3. Set each subject's price and duration. Lifetime means no expiry.
4. Use Lock All / Unlock All for platform-wide control.
5. Use each subject's own switch for individual access control.
6. Save individual changes.

Only Super Admin can edit monetization controls. Staff roles are intentionally denied.

## Student use
1. Student signs in and opens Subject Wise Mock Test.
2. Student chooses a subject and pays the displayed amount.
3. Access activates only after the server verifies the Razorpay payment is captured and its signature/order/amount match.
4. Access expires according to the duration set by Admin. An Admin lock overrides a valid purchase until the subject is unlocked again.

## Important
- Existing free tests outside the subject-random practice flow are unchanged.
- This implementation does not make all mock tests paid; it protects subject-random mock tests only.
- Payment and live deployment must be tested on Razorpay Test Mode and the production Supabase project before announcing paid access.


## 24-hour new-student trial update
Also run `supabase/migrations/20261122220000_student_24h_trial_access.sql` in Supabase SQL Editor after the original subject paid-access migration. The 24-hour trial is calculated from each student's Supabase Auth account creation time. New students can start subject-wise mock tests during that window; after expiry, only subjects with an active purchased entitlement (or subjects the Admin sets to ₹0) remain accessible. No manual approval is required after a successful, server-verified Razorpay payment.

The site middleware now redirects unauthenticated visitors to `/login` for protected pages. Login, signup, password reset, and the additional-device payment page remain available without an active student session. Admin pages retain their separate admin authentication.
