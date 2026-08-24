CREATE TABLE IF NOT EXISTS public.meal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE RESTRICT,
  worker_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  meal_date date NOT NULL,
  meal_type text NOT NULL CHECK (length(trim(meal_type)) > 0),
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_history_school_date_idx ON public.meal_history (school_id, meal_date DESC);
CREATE INDEX IF NOT EXISTS meal_history_class_idx ON public.meal_history (class_id);
CREATE INDEX IF NOT EXISTS meal_history_child_idx ON public.meal_history (child_id);
CREATE INDEX IF NOT EXISTS meal_history_worker_idx ON public.meal_history (worker_id);
ALTER TABLE public.meal_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_meal_history_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.classes classroom
    JOIN public.children child ON child.id = NEW.child_id
    WHERE classroom.id = NEW.class_id
      AND classroom.school_id = NEW.school_id
      AND child.class_id = NEW.class_id
  ) OR (
    NEW.worker_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.users worker
      WHERE worker.id = NEW.worker_id
        AND worker.school_id = NEW.school_id
    )
  ) THEN
    RAISE EXCEPTION 'Meal history relations must belong to the selected school';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_meal_history_scope ON public.meal_history;
CREATE TRIGGER validate_meal_history_scope
  BEFORE INSERT OR UPDATE ON public.meal_history
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meal_history_scope();

DROP POLICY IF EXISTS meal_history_select ON public.meal_history;
CREATE POLICY meal_history_select ON public.meal_history
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  );
