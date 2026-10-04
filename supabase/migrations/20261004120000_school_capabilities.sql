-- School-level capability values default to enabled. Class rows are optional
-- overrides, so new classes automatically inherit the current school value.
CREATE TABLE public.capability_catalog (
  capability text PRIMARY KEY,
  default_enabled boolean NOT NULL DEFAULT true
);

INSERT INTO public.capability_catalog (capability, default_enabled) VALUES
  ('family_meal_records', true),
  ('monitor_internal_notifications', true),
  ('monitor_daily_summary', true);

CREATE TABLE public.school_capabilities (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  capability text NOT NULL REFERENCES public.capability_catalog(capability),
  enabled boolean NOT NULL,
  PRIMARY KEY (school_id, capability)
);

CREATE TABLE public.class_capability_overrides (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  capability text NOT NULL REFERENCES public.capability_catalog(capability),
  enabled boolean NOT NULL,
  PRIMARY KEY (class_id, capability)
);

-- Supervisors have no school_id on the live users table. Assignments are the
-- sole source of supervisor capability scope.
CREATE TABLE public.school_supervisor_assignments (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  supervisor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (school_id, supervisor_id)
);

CREATE INDEX school_supervisor_assignments_supervisor_id_idx
  ON public.school_supervisor_assignments (supervisor_id);

ALTER TABLE public.capability_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_capability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_supervisor_assignments ENABLE ROW LEVEL SECURITY;

-- The tables are an implementation detail. All reads and writes go through
-- role-checked functions below; class writes resolve the target school's
-- scope from the class row before checking the caller's assignment.
REVOKE ALL ON TABLE public.capability_catalog FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.school_capabilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.class_capability_overrides FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.school_supervisor_assignments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_manage_school_capabilities(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.current_user_active()
     AND EXISTS (
        SELECT 1
          FROM public.schools s
         WHERE s.id = p_school_id
           AND (
             public.current_user_role() = 'admin'
             OR (
               public.current_user_role() = 'supervisor'
               AND EXISTS (
                 SELECT 1
                   FROM public.school_supervisor_assignments a
                  WHERE a.school_id = s.id
                    AND a.supervisor_id = public.current_user_id()
               )
             )
           )
      );
$function$;
REVOKE ALL ON FUNCTION public.current_user_can_manage_school_capabilities(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_school_capabilities(uuid) TO authenticated;

-- Keep assigned supervisors' class list visible to the capability management
-- page while preserving the existing parent/monitor read policies.
DROP POLICY IF EXISTS classes_select_assigned_supervisors ON public.classes;
CREATE POLICY classes_select_assigned_supervisors ON public.classes
  FOR SELECT TO authenticated
  USING (public.current_user_can_manage_school_capabilities(school_id));

-- The management page loads its school row before requesting capability
-- settings. Add this narrowly scoped path without changing existing school
-- SELECT policies (including the admin policy).
CREATE POLICY schools_select_assigned_capability_supervisors ON public.schools
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'supervisor'
    AND public.current_user_can_manage_school_capabilities(id)
  );

CREATE OR REPLACE FUNCTION public.get_school_supervisor_assignments(p_school_id uuid)
RETURNS TABLE (
  supervisor_id uuid,
  full_name text,
  active boolean,
  assigned boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.current_user_active()
     OR public.current_user_role() IS DISTINCT FROM 'admin'
     OR NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.full_name, u.active, a.supervisor_id IS NOT NULL
    FROM public.users u
    LEFT JOIN public.school_supervisor_assignments a
      ON a.school_id = p_school_id
     AND a.supervisor_id = u.id
   WHERE u.role::text = 'supervisor'
   ORDER BY lower(coalesce(u.full_name, '')), u.id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_school_supervisor_assignment(
  p_school_id uuid,
  p_supervisor_id uuid,
  p_assigned boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.current_user_active()
     OR public.current_user_role() IS DISTINCT FROM 'admin'
     OR NOT EXISTS (SELECT 1 FROM public.schools s WHERE s.id = p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  IF p_assigned IS NULL OR NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = p_supervisor_id
       AND u.role::text = 'supervisor'
  ) THEN
    RAISE EXCEPTION 'Expected an existing supervisor and an assignment state'
      USING ERRCODE = '22023';
  END IF;

  IF p_assigned THEN
    INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id)
    VALUES (p_school_id, p_supervisor_id)
    ON CONFLICT (school_id, supervisor_id) DO NOTHING;
  ELSE
    DELETE FROM public.school_supervisor_assignments a
     WHERE a.school_id = p_school_id
       AND a.supervisor_id = p_supervisor_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_capability_settings(p_school_id uuid)
RETURNS TABLE (
  class_id uuid,
  capability text,
  school_value boolean,
  override_value boolean,
  enabled boolean,
  source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.current_user_can_manage_school_capabilities(p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    NULL::uuid,
    k.capability,
    COALESCE(s.enabled, k.default_enabled),
    NULL::boolean,
    COALESCE(s.enabled, k.default_enabled),
    CASE WHEN s.enabled IS NULL THEN 'default'::text ELSE 'school'::text END
  FROM public.capability_catalog k
  LEFT JOIN public.school_capabilities s
    ON s.school_id = p_school_id
   AND s.capability = k.capability

  UNION ALL

  SELECT
    c.id,
    k.capability,
    COALESCE(s.enabled, k.default_enabled),
    o.enabled,
    COALESCE(o.enabled, s.enabled, k.default_enabled),
    CASE
      WHEN o.enabled IS NOT NULL THEN 'class'::text
      WHEN s.enabled IS NOT NULL THEN 'school'::text
      ELSE 'default'::text
    END
  FROM public.classes c
  CROSS JOIN public.capability_catalog k
  LEFT JOIN public.school_capabilities s
    ON s.school_id = c.school_id
   AND s.capability = k.capability
  LEFT JOIN public.class_capability_overrides o
    ON o.class_id = c.id
   AND o.capability = k.capability
  WHERE c.school_id = p_school_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_effective_capabilities(
  p_class_id uuid DEFAULT NULL,
  p_child_id uuid DEFAULT NULL
)
RETURNS TABLE (capability text, enabled boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_role text := public.current_user_role();
  v_class_id uuid;
  v_school_id uuid;
BEGIN
  IF (p_class_id IS NULL) = (p_child_id IS NULL) THEN
    RAISE EXCEPTION 'Provide exactly one class or child'
      USING ERRCODE = '22023';
  END IF;

  IF p_child_id IS NOT NULL THEN
    IF v_role IS NULL
       OR v_role NOT IN ('parent', 'padre')
       OR NOT private.current_user_can_access_child(p_child_id) THEN
      RAISE EXCEPTION 'Child not found or not accessible'
        USING ERRCODE = '42501';
    END IF;

    SELECT c.id, c.school_id
      INTO v_class_id, v_school_id
      FROM public.children ch
      JOIN public.classes c ON c.id = ch.class_id
     WHERE ch.id = p_child_id;
  ELSE
    SELECT c.id, c.school_id
      INTO v_class_id, v_school_id
      FROM public.classes c
     WHERE c.id = p_class_id;

    IF v_class_id IS NULL OR v_school_id IS NULL THEN
      RAISE EXCEPTION 'Class not found or not accessible'
        USING ERRCODE = '42501';
    END IF;

    IF v_role IN ('admin', 'supervisor') THEN
      IF NOT public.current_user_can_manage_school_capabilities(v_school_id) THEN
        RAISE EXCEPTION 'Class not found or not accessible'
          USING ERRCODE = '42501';
      END IF;
    ELSIF v_role = 'monitor' THEN
      IF NOT private.current_user_can_access_class(p_class_id) THEN
        RAISE EXCEPTION 'Class not found or not accessible'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Class not found or not accessible'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_class_id IS NULL OR v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    k.capability,
    COALESCE(o.enabled, s.enabled, k.default_enabled)
  FROM public.capability_catalog k
  LEFT JOIN public.school_capabilities s
    ON s.school_id = v_school_id
   AND s.capability = k.capability
  LEFT JOIN public.class_capability_overrides o
    ON o.class_id = v_class_id
   AND o.capability = k.capability;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_school_capability(
  p_school_id uuid,
  p_capability text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF p_capability IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.capability_catalog c WHERE c.capability = p_capability
  ) THEN
    RAISE EXCEPTION 'Unknown capability: %', p_capability
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.current_user_can_manage_school_capabilities(p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.school_capabilities (school_id, capability, enabled)
  VALUES (p_school_id, p_capability, p_enabled)
  ON CONFLICT (school_id, capability)
  DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$function$;

-- Shared validation and scope resolution for class-level capability writes.
-- This helper is callable only through the SECURITY DEFINER mutation RPCs.
CREATE OR REPLACE FUNCTION private.assert_class_capability_scope(
  p_class_id uuid,
  p_capability text
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_school_id uuid;
BEGIN
  IF p_capability IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.capability_catalog c WHERE c.capability = p_capability
  ) THEN
    RAISE EXCEPTION 'Unknown capability: %', p_capability
      USING ERRCODE = '22023';
  END IF;

  SELECT c.school_id
    INTO v_school_id
    FROM public.classes c
   WHERE c.id = p_class_id;

  IF v_school_id IS NULL
     OR NOT public.current_user_can_manage_school_capabilities(v_school_id) THEN
    RAISE EXCEPTION 'Class not found or not accessible'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION private.assert_class_capability_scope(uuid, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_class_capability(
  p_class_id uuid,
  p_capability text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM private.assert_class_capability_scope(p_class_id, p_capability);

  INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
  VALUES (p_class_id, p_capability, p_enabled)
  ON CONFLICT (class_id, capability)
  DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_class_capability(
  p_class_id uuid,
  p_capability text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  PERFORM private.assert_class_capability_scope(p_class_id, p_capability);

  DELETE FROM public.class_capability_overrides o
   WHERE o.class_id = p_class_id
     AND o.capability = p_capability;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_capability_settings(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_effective_capabilities(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_school_capability(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_class_capability(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_class_capability(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_school_supervisor_assignments(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_school_supervisor_assignment(uuid, uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_capability_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_capabilities(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_capability(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_class_capability(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_class_capability(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_school_supervisor_assignments(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_supervisor_assignment(uuid, uuid, boolean) TO authenticated;
