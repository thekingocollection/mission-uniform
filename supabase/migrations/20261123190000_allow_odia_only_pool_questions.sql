-- Allow Odia-only and English-only questions in reusable mock-test pools.
ALTER TABLE public.pool_questions
  ALTER COLUMN question_hi DROP NOT NULL;
