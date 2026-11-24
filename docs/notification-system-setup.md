# Mission Uniform notification delivery setup

## 1. Apply the database migration

Run this file in Supabase SQL Editor:

`supabase/migrations/20261125090000_notification_campaigns_and_push.sql`

It creates campaign, student inbox and browser push-subscription tables. These tables have RLS enabled and are accessed through authenticated Next.js APIs using the server service-role key.

## 2. Add Render environment variables

Required for Web Push:
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public VAPID key
- `VAPID_PRIVATE_KEY` — private VAPID key (keep secret; never expose it to the browser)
- `VAPID_SUBJECT` — a contact URI such as `mailto:admin@example.com`

Generate a key pair locally after installing project dependencies:
```bash
npx web-push generate-vapid-keys
```
Copy the public key to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key to `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to a monitored email address.

Also set `CRON_SECRET` to a long random secret, for example:
```bash
openssl rand -hex 32
```

The public VAPID key is intentionally exposed to the browser. The private key and CRON_SECRET must remain server-only.

## 3. Configure scheduled delivery

The app exposes:
`POST https://mission-uniform.onrender.com/api/cron/notification-campaigns`

Configure an external cron provider to call it every minute with this header:
`Authorization: Bearer YOUR_CRON_SECRET`

The endpoint processes up to 20 due campaigns per run. It returns 401 if CRON_SECRET is missing or incorrect. Admins can also use **Process Due Campaigns** in the Notification Campaigns page for manual processing.

## 4. Student setup

Students open `/notifications` and choose **Enable Notifications**. The browser asks for permission; after approval the subscription is saved to Supabase. Push requires HTTPS and a browser/device that supports Web Push. Students can turn push off from the same page.

## 5. Admin use

Open `/admin/notifications`. Super Admins have access automatically. Staff Admins need the existing `manage_notifications` permission enabled in Staff Management.

Campaign audiences:
- All students
- Active in last 7 days (based on live-presence heartbeats)
- Inactive for the selected number of days
- New registrations in last 7 days

The campaign history reports recipient counts, push delivery/failure counts, reads and clicks. Push delivery is best-effort; browser permission, device connectivity and provider delivery determine whether a push appears.
