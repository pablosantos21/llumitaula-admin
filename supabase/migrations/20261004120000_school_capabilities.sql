-- School-level capability values default to enabled. Class rows are optional
-- overrides, so new classes automatically inherit the current school value.
CREATE TABLE public.school_capabilities (
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN (
    'family_meal_records',
    'monitor_internal_notifications',
    'monitor_daily_summary'
  )),
  enabled boolean NOT NULL,
  PRIMARY KEY (school_id, capability)
);

CREATE TABLE public.class_capability_overrides (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  capability text NOT NULL CHECK (capability IN (
    'family_meal_records',
    'monitor_internal_notifications',
    'monitor_daily_summary'
  )),
  enabled boolean NOT NULL,
  PRIMARY KEY (class_id, capability)
);

ALTER TABLE public.school_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_capability_overrides ENABLE ROW LEVEL SECURITY;

-- The tables are an implementation detail. All reads and writes go through
-- role-checked functions below; class writes also validate the class through
-- the shared tenant-access helper.
REVOKE ALL ON TABLE public.school_capabilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.class_capability_overrides FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.can_manage_school_capabilities(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.current_user_active()
     AND public.current_user_role() IN ('admin', 'supervisor')
     AND EXISTS (
       SELECT 1
         FROM public.schools s
        WHERE s.id = p_school_id
     );
$function$;
REVOKE ALL ON FUNCTION private.can_manage_school_capabilities(uuid) FROM PUBLIC, anon, authenticated;

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
  IF NOT private.can_manage_school_capabilities(p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH capability_keys(capability) AS (
    VALUES
      ('family_meal_records'::text),
      ('monitor_internal_notifications'::text),
      ('monitor_daily_summary'::text)
  )
  SELECT
    NULL::uuid,
    k.capability,
    COALESCE(s.enabled, true),
    NULL::boolean,
    COALESCE(s.enabled, true),
    CASE WHEN s.enabled IS NULL THEN 'default'::text ELSE 'school'::text END
  FROM capability_keys k
  LEFT JOIN public.school_capabilities s
    ON s.school_id = p_school_id
   AND s.capability = k.capability

  UNION ALL

  SELECT
    c.id,
    k.capability,
    COALESCE(s.enabled, true),
    o.enabled,
    COALESCE(o.enabled, s.enabled, true),
    CASE
      WHEN o.enabled IS NOT NULL THEN 'class'::text
      WHEN s.enabled IS NOT NULL THEN 'school'::text
      ELSE 'default'::text
    END
  FROM public.classes c
  CROSS JOIN capability_keys k
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
    IF v_role <> 'parent'
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
    IF v_role NOT IN ('admin', 'supervisor', 'monitor')
       OR NOT private.current_user_can_access_class(p_class_id) THEN
      RAISE EXCEPTION 'Class not found or not accessible'
        USING ERRCODE = '42501';
    END IF;

    SELECT c.id, c.school_id
      INTO v_class_id, v_school_id
      FROM public.classes c
     WHERE c.id = p_class_id;
  END IF;

  IF v_class_id IS NULL OR v_school_id IS NULL THEN
    RAISE EXCEPTION 'Class not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH capability_keys(capability) AS (
    VALUES
      ('family_meal_records'::text),
      ('monitor_internal_notifications'::text),
      ('monitor_daily_summary'::text)
  )
  SELECT
    k.capability,
    COALESCE(o.enabled, s.enabled, true)
  FROM capability_keys k
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
  IF p_capability IS NULL OR p_capability NOT IN (
    'family_meal_records',
    'monitor_internal_notifications',
    'monitor_daily_summary'
  ) THEN
    RAISE EXCEPTION 'Unknown capability: %', p_capability
      USING ERRCODE = '22023';
  END IF;

  IF NOT private.can_manage_school_capabilities(p_school_id) THEN
    RAISE EXCEPTION 'School not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.school_capabilities (school_id, capability, enabled)
  VALUES (p_school_id, p_capability, p_enabled)
  ON CONFLICT (school_id, capability)
  DO UPDATE SET enabled = EXCLUDED.enabled;
END;
$function$;

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
DECLARE
  v_school_id uuid;
BEGIN
  IF p_capability IS NULL OR p_capability NOT IN (
    'family_meal_records',
    'monitor_internal_notifications',
    'monitor_daily_summary'
  ) THEN
    RAISE EXCEPTION 'Unknown capability: %', p_capability
      USING ERRCODE = '22023';
  END IF;

  SELECT c.school_id
    INTO v_school_id
    FROM public.classes c
   WHERE c.id = p_class_id;

  IF v_school_id IS NULL
     OR NOT private.can_manage_school_capabilities(v_school_id)
     OR NOT private.current_user_can_access_class(p_class_id) THEN
    RAISE EXCEPTION 'Class not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

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
DECLARE
  v_school_id uuid;
BEGIN
  IF p_capability IS NULL OR p_capability NOT IN (
    'family_meal_records',
    'monitor_internal_notifications',
    'monitor_daily_summary'
  ) THEN
    RAISE EXCEPTION 'Unknown capability: %', p_capability
      USING ERRCODE = '22023';
  END IF;

  SELECT c.school_id
    INTO v_school_id
    FROM public.classes c
   WHERE c.id = p_class_id;

  IF v_school_id IS NULL
     OR NOT private.can_manage_school_capabilities(v_school_id)
     OR NOT private.current_user_can_access_class(p_class_id) THEN
    RAISE EXCEPTION 'Class not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_capability_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_capabilities(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_school_capability(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_class_capability(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_class_capability(uuid, text) TO authenticated;
