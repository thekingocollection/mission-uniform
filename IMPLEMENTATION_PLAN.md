# MISSION UNIFORM OP — Complete Upgrade Implementation Plan

## Product rules
- Student learning, tests, results and study material remain free.
- No subscription/paywall/payment checkout.
- No advertisements inside active exam screens. Keep AdSense and clearly labelled sponsored promotions separate.
- Publish recruitment alerts only after an administrator checks the official notice.
- WhatsApp messages require recorded, revocable opt-in.

## Modules delivered in this upgrade

| Module | Route | Main behavior | External setup |
|---|---|---|---|
| AI Study Assistant | `/ai-study-assistant` | Authenticated Q&A; Hindi/Odia/English; up to 30 prompts per rolling 24h | OpenAI API key |
| All India Leaderboard | `/leaderboard` | Daily, weekly and all-time aggregate ranks | Supabase migration + valid server-recorded attempts |
| Government Job Alerts | `/job-alerts` | Searchable public vacancy list, official links and verification labels | Admin-curated job data |
| Job Alerts Admin | `/admin/job-alerts` | Create, publish/unpublish and delete alerts | Admin Supabase role |
| WhatsApp Preferences | `/notifications` | Opt-in topics and stop-all control | Supabase Phone Auth + Meta WhatsApp Cloud API |
| WhatsApp Sender | `/api/whatsapp/send` | Secret-protected template message batch by topic | Meta approved template + scheduler |
| Phone OTP Auth | `/login`, `/signup` | Send and verify Indian mobile OTP | Supabase Phone Auth + SMS provider |

## Rollout sequence

### Phase 1 — Database and authentication
1. Create a Supabase staging project or take a production backup.
2. Run existing `supabase/schema.sql`, `supabase/adsense.sql`, and `supabase/personal_ads.sql` if not already applied.
3. Run `supabase/complete_upgrade.sql` last.
4. Enable Supabase Phone Auth and configure an SMS provider, allowed redirect URLs, CAPTCHA and rate limits.
5. Test signup, OTP verification, profile creation and logout/session expiry.
6. Promote the first admin through Supabase SQL Editor only; do not let students update their own role.

### Phase 2 — AI Study Assistant
1. Add `OPENAI_API_KEY` and optional `OPENAI_MODEL` as server-only Vercel variables.
2. Test Hindi, Odia and English prompts with a non-admin student account.
3. Confirm unauthenticated requests fail and the rolling quota is enforced.
4. Set provider spend limits and monitor usage before public launch.

### Phase 3 — Job alerts
1. Admin adds title, organization, qualification, last date and official HTTPS notice URL.
2. Verify details from the recruiting organization's official website/PDF.
3. Mark verified and publish only after review.
4. Recheck deadline/status and unpublish expired or withdrawn notices.

### Phase 4 — Leaderboard
1. Do not enable public ranking until test attempts are submitted and scored by a trusted server-side grading route.
2. Keep direct client writes to `attempts` disabled; otherwise students could forge scores.
3. Assign non-identifying public display aliases to students.
4. Test daily/weekly/all-time cutoffs, tie-breaks and privacy using separate accounts.

### Phase 5 — WhatsApp
1. Configure Meta WhatsApp Business Platform and a verified sender number.
2. Submit and receive approval for message templates in the selected language.
3. Add server-only WhatsApp environment variables.
4. Ask students to opt in on `/notifications`; test the stop-all option.
5. Trigger `/api/whatsapp/send` from a trusted scheduler using the secret bearer token and a valid topic. Start with a small internal test group.
6. Add delivery-status webhook, retry strategy, opt-out keyword processing and audit logs before scaling.

### Phase 6 — Deployment and QA
1. Push code to a private GitHub repository.
2. Import into Vercel; add public Supabase URL/anon key and server-only keys separately.
3. Deploy to Preview first; run database migrations in staging.
4. Test mobile layout, auth, AI limits, job alert permissions, leaderboard privacy, WhatsApp consent and ad placement.
5. Verify no ads are mounted in active exam screens. Keep `NEXT_PUBLIC_ADS_ENABLED=false` until AdSense approval and consent requirements are satisfied.
6. Production release only after the existing CBT engine has secure server-side grading and an adequate verified question bank.

## Acceptance checklist
- [ ] Student can register/login by SMS OTP after Supabase provider setup.
- [ ] AI rejects anonymous requests, enforces quota and never exposes provider key.
- [ ] Public job page exposes published records only; admin can manage drafts.
- [ ] Leaderboard exposes alias and aggregate metrics only.
- [ ] No client can insert or alter attempt scores after the migration.
- [ ] WhatsApp subscription requires explicit consent and user can stop messages.
- [ ] WhatsApp sender requires a server secret and uses approved templates.
- [ ] No paid features or paywalls are introduced.
- [ ] Ads remain outside live test screens.

## Scope boundary
This upgrade adds the four requested feature modules, phone OTP screens, database migration and setup documentation. The supplied starter still does not contain a complete exam-taking engine, server-side grading workflow, full question-bank CRUD/import, or delivery-status webhook for WhatsApp. Those are separate production milestones and must not be represented as already completed.
