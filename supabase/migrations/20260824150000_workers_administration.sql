-- The worker-facing application owns the canonical worker model. Keep this
-- migration idempotent so the admin project can be deployed independently.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.worker_classrooms (
  worker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worker_id, class_id)
);

CREATE INDEX IF NOT EXISTS worker_classrooms_class_id_idx
  ON public.worker_classrooms (class_id);

ALTER TABLE public.worker_classrooms ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS worker_classrooms_select_admin ON public.worker_classrooms;
CREATE POLICY worker_classrooms_select_admin ON public.worker_classrooms
  FOR SELECT TO authenticated USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
        AND ((select auth.jwt()) ->> 'role') = 'supervisor'
        AND c.school_id = public.current_user_school_id()
    )
  );

DROP POLICY IF EXISTS worker_classrooms_write_admin ON public.worker_classrooms;
CREATE POLICY worker_classrooms_write_admin ON public.worker_classrooms
  FOR ALL TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
        AND ((select auth.jwt()) ->> 'role') = 'supervisor'
        AND c.school_id = public.current_user_school_id()
    )
  )
  WITH CHECK (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.classes c
      WHERE c.id = class_id
        AND ((select auth.jwt()) ->> 'role') = 'supervisor'
        AND c.school_id = public.current_user_school_id()
    )
  );
