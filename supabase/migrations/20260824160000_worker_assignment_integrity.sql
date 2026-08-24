-- Keep worker assignments inside the worker's school and allow only active classrooms.
CREATE OR REPLACE FUNCTION public.validate_worker_classroom_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users worker
    JOIN public.classes classroom ON classroom.school_id = worker.school_id
    WHERE worker.id = NEW.worker_id
      AND classroom.id = NEW.class_id
      AND classroom.is_active
  ) THEN
    RAISE EXCEPTION 'Worker assignments require an active classroom in the worker school';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_worker_classroom_assignment ON public.worker_classrooms;
CREATE TRIGGER validate_worker_classroom_assignment
  BEFORE INSERT OR UPDATE ON public.worker_classrooms
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_worker_classroom_assignment();

-- Supervisors can manage workers in their school but cannot escalate roles.
CREATE OR REPLACE FUNCTION public.prevent_supervisor_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role IS DISTINCT FROM NEW.role
     AND (select auth.jwt() ->> 'role') = 'supervisor' THEN
    RAISE EXCEPTION 'Only administrators can change worker roles';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_supervisor_role_escalation ON public.users;
CREATE TRIGGER prevent_supervisor_role_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_supervisor_role_escalation();
