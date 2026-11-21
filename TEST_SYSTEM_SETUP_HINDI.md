# MISSION UNIFORM OP – Test System V1

## Is update me kya mila
- Admin Test Paper Builder: Daily, Subject, Chapter, Full Mock aur Grand Test.
- Subject aur Chapter filter; sirf `is_active=true` aur `verified=true` question list me aate hain.
- Question selection, duration, total question count, negative marking, Draft/Published status.
- Student side par sirf published papers dikhte hain.
- Student test ke questions API se aate hain; `correct_option` browser ko nahi bheja jata.
- Submit par server answer check karta hai aur `test_attempts` me result save karta hai.
- Excel/question import se `questions.chapter` me chapter value aane par `chapters` table auto-sync hoti hai. Admin Question Bank me chapter text edit karega to trigger catalogue update karega.

## Install steps
1. Supabase Dashboard → SQL Editor kholiye.
2. `supabase/test_system_upgrade.sql` ka poora SQL run kijiye.
3. Confirm karein ki `.env.local` me ye variables hain:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ya `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY` (sirf server; `NEXT_PUBLIC_` prefix kabhi na lagayein)
4. Is folder ko apne existing project folder me merge/replace karein.
5. Terminal me `npm install` phir `npm run build` aur `npm run dev`.
6. Super Admin login → Admin → Tests (`/admin/tests`) → test create karein → Draft ya Published save karein.
7. Student `/tests` par published papers dekhega.

## Important
- Purana `supabase/schema.sql` ya `supabase/live_exam_upgrade.sql` dobara run na karein; woh purane schema ke liye hain.
- Existing `attempts` table ko touch nahi kiya gaya. New results `test_attempts` me save honge.
- Questions tabhi selectable honge jab `is_active=true` aur `verified=true`.
- `correct_option` server-side grading ke liye use hota hai. Student questions endpoint is field ko expose nahi karta.
- Test attempt insert service-role API route se hota hai, pehle Supabase access token validate kiya jata hai.
- This version does not yet include Excel file upload inside Test Builder, automatic timer/auto-submit, answer explanations in result review, or attempt-history UI. Existing Excel question import can continue; chapter auto-sync trigger is included.
- Before production use, test with one dummy paper and a non-admin student account.
