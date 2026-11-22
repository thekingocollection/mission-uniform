-- Allow English-only, Odia-only and English+Odia question banks.
-- Hindi fields are optional; the admin importer validates that at least one
-- supported question language is supplied for each row.
ALTER TABLE public.questions
  ALTER COLUMN question_hi DROP NOT NULL;

ALTER TABLE public.questions
  ALTER COLUMN explanation_hi DROP NOT NULL;
