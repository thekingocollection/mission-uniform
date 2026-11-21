# Live exam setup
1. In Supabase SQL Editor, run `schema.sql` if not already run.
2. Run `live_exam_upgrade.sql`.
3. Run `seed.sql` if you want the initial subjects.
4. Sign in to the site, then promote your own account to super_admin from SQL Editor:
   `update public.profiles set role='super_admin' where id='YOUR_AUTH_USER_UUID';`
5. Sign out/in again, open `/admin/questions`, create questions and mark them Published.

The student page reads only `public_questions` (correct answers are not exposed). Submission is scored in the `submit_mock_attempt` SQL function and stored in `attempts` under the authenticated user's ID. The question editor uses RLS-protected direct table access and is visible only to admin roles.
