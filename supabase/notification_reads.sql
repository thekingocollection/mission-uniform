-- Student notification read receipts.
-- Run after public.notifications and public.profiles have been created.
CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own notification receipts" ON public.notification_reads;
CREATE POLICY "students read own notification receipts"
ON public.notification_reads FOR SELECT
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "students create own notification receipts" ON public.notification_reads;
CREATE POLICY "students create own notification receipts"
ON public.notification_reads FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "students update own notification receipts" ON public.notification_reads;
CREATE POLICY "students update own notification receipts"
ON public.notification_reads FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.notification_reads TO authenticated;
NOTIFY pgrst, 'reload schema';
