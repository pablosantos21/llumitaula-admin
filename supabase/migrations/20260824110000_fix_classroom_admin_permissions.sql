-- Enforce classroom administration permissions and prevent inactive assignments.

-- ============ classes ==========
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;

CREATE POLICY classes_insert ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));
CREATE POLICY classes_update ON public.classes
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'))
  WITH CHECK ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));
CREATE POLICY classes_delete ON public.classes
  FOR DELETE TO authenticated
  USING ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));

-- ============ schools ==========
DROP POLICY IF EXISTS schools_update ON public.schools;

CREATE POLICY schools_update ON public.schools
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'))
  WITH CHECK ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));

-- ============ children ==========
DROP POLICY IF EXISTS children_insert ON public.children;
DROP POLICY IF EXISTS children_update ON public.children;

CREATE POLICY children_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));
CREATE POLICY children_update ON public.children
  FOR UPDATE TO authenticated
  USING ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'))
  WITH CHECK ((select auth.jwt() ->> 'role') IN ('admin', 'supervisor'));

-- Only new assignments and class changes may target active classes. Existing
-- assignments remain valid when unrelated child fields are updated.
CREATE OR REPLACE FUNCTION public.prevent_inactive_class_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_validate boolean := TG_OP = 'INSERT';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    should_validate := NEW.class_id IS DISTINCT FROM OLD.class_id;
  END IF;

  IF should_validate AND NOT EXISTS (
    SELECT 1
    FROM public.classes
    WHERE id = NEW.class_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot assign a child to an inactive class';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_inactive_class_assignment ON public.children;
CREATE TRIGGER prevent_inactive_class_assignment
  BEFORE INSERT OR UPDATE ON public.children
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inactive_class_assignment();
