# Partner Panel Upgrade — Deployment Notes

This upgrade keeps the existing partner accounts, referral codes, student referrals, commission ledger and paid payout history.

## Required Supabase migration

Before deploying the new app code, open Supabase Dashboard → SQL Editor and run the complete file:

`supabase/migrations/20261126120000_partner_analytics_manual_payouts.sql`

It creates only two new tables:
- `partner_clicks`: referral landing visits, deduplicated by partner + browser session key.
- `partner_payout_requests`: manual UPI/bank payout requests and their review/payment status.

Existing partner tables are not dropped or rewritten. Both new tables have RLS enabled and are accessed only by server routes using the service role after authentication/role checks.

## Referral click measurement

A signup page visit containing an approved `?ref=CODE` is recorded once per browser session. This is a landing visit metric, not a verified unique person or a registration. Student registrations continue to be attributed by the existing profile trigger. Premium sales and commissions continue to come from the existing paid payment transaction trigger.

## Manual payout workflow

1. Partner submits a request for the full unpaid commission balance (minimum ₹100) using UPI ID or bank account details.
2. Super Admin opens `/admin/partner-payouts`, reviews the request and payment details, then approves or rejects it.
3. After manually transferring funds, Admin enters the actual bank/UPI transaction reference and marks the request Paid.
4. The server records the existing payout ledger entry and marks the corresponding outstanding commission rows Paid. No payment gateway or automatic transfer is initiated.

Never ask partners for UPI PIN, OTP, card PIN or banking passwords. Payout account details are visible only to the authenticated partner via request status and to Super Admin in the admin payout screen.

## Marketing Kit

The Partner Workspace provides copy-ready WhatsApp, Instagram and short-video captions with the partner's actual referral URL. These are text templates; no fake impressions, campaign reach or generated poster downloads are shown.
