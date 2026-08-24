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
