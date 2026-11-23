-- Prevent duplicate student identities at the database level.
-- Existing duplicate records are reported before indexes are created; resolve
-- those rows first, then rerun this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE NULLIF(LOWER(BTRIM(email)), '') IS NOT NULL
    GROUP BY LOWER(BTRIM(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate profile email addresses exist. Resolve duplicate profiles before applying the unique email index.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE NULLIF(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), '') IS NOT NULL
    GROUP BY REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate profile mobile numbers exist. Resolve duplicate profiles before applying the unique mobile index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci
  ON public.profiles (LOWER(BTRIM(email)))
  WHERE NULLIF(BTRIM(email), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_normalized
  ON public.profiles (REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'))
  WHERE NULLIF(REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g'), '') IS NOT NULL;
