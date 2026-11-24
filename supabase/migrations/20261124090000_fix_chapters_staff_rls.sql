-- Fix chapter INSERT/UPDATE RLS for Super Admin and authorized staff.
-- Use a direct profile check so chapter writes do not depend on a stale/misconfigured helper policy.

DROP POLICY IF EXISTS "published chapters visible" ON public.chapters;
DROP POLICY IF EXISTS "admin manage chapters" ON public.chapters;
DROP POLICY IF EXISTS "published chapters or authorized manager" ON public.chapters;
DROP POLICY IF EXISTS "authorized manage chapters" ON public.chapters;
DROP POLICY IF EXISTS "chapters_select_authorized" ON public.chapters;
DROP POLICY IF EXISTS "chapters_manage_authorized" ON public.chapters;

CREATE POLICY "chapters_select_authorized"
ON public.chapters
FOR SELECT
TO authenticated
USING (
  published IS TRUE
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_blocked IS FALSE
      AND (
        p.role = 'super_admin'
        OR (
          p.role = 'staff_admin'
          AND COALESCE((p.permissions ->> 'manage_subjects')::boolean, false) IS TRUE
        )
      )
  )
);

CREATE POLICY "chapters_manage_authorized"
ON public.chapters
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_blocked IS FALSE
      AND (
        p.role = 'super_admin'
        OR (
          p.role = 'staff_admin'
          AND COALESCE((p.permissions ->> 'manage_subjects')::boolean, false) IS TRUE
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.is_blocked IS FALSE
      AND (
        p.role = 'super_admin'
        OR (
          p.role = 'staff_admin'
          AND COALESCE((p.permissions ->> 'manage_subjects')::boolean, false) IS TRUE
        )
      )
  )
);

NOTIFY pgrst, 'reload schema';
