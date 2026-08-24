-- The worker-facing application owns the canonical worker model. Keep this
-- migration idempotent so the admin project can be deployed independently.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid() AND active;
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_school_id() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated, service_role;

DROP POLICY IF EXISTS users_select_workers ON public.users;
CREATE POLICY users_select_workers ON public.users
  FOR SELECT TO authenticated USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  );

DROP POLICY IF EXISTS users_update_workers ON public.users;
CREATE POLICY users_update_workers ON public.users
  FOR UPDATE TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  )
  WITH CHECK (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  );


