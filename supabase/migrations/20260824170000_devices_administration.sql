CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  config_code_hash text,
  config_code_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS devices_school_id_idx ON public.devices (school_id);
CREATE INDEX IF NOT EXISTS devices_active_idx ON public.devices (active);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS devices_select ON public.devices;
CREATE POLICY devices_select ON public.devices
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  );

DROP POLICY IF EXISTS devices_insert ON public.devices;
CREATE POLICY devices_insert ON public.devices
  FOR INSERT TO authenticated
  WITH CHECK (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = public.current_user_school_id()
    )
  );

DROP POLICY IF EXISTS devices_update ON public.devices;
CREATE POLICY devices_update ON public.devices
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

CREATE OR REPLACE FUNCTION public.prevent_device_reactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF OLD.active AND NOT NEW.active THEN
    NEW.revoked_at := coalesce(NEW.revoked_at, now());
    NEW.config_code_hash := NULL;
  END IF;

  IF OLD.revoked_at IS NOT NULL
     AND (NEW.active OR NEW.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'Revoked devices cannot be reactivated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_device_reactivation ON public.devices;
CREATE TRIGGER prevent_device_reactivation
  BEFORE UPDATE ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_device_reactivation();

CREATE OR REPLACE FUNCTION public.generate_device_config_code(p_device_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  code text := 'LLM-' || upper(encode(gen_random_bytes(18), 'hex'));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = p_device_id
      AND d.active
      AND (
        (select auth.jwt() ->> 'role') = 'admin'
        OR (
          (select auth.jwt() ->> 'role') = 'supervisor'
          AND d.school_id = public.current_user_school_id()
        )
      )
  ) THEN
    RAISE EXCEPTION 'Device not found, inactive, or not accessible';
  END IF;

  UPDATE public.devices
  SET config_code_hash = encode(digest(code, 'sha256'), 'hex'),
      config_code_created_at = now()
  WHERE id = p_device_id;

  RETURN code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_device_config_code(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_device_config_code(uuid) TO authenticated;
