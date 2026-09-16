-- Issue #14 (admin): binding-history read model.
--
-- `device_claims` is the audit row the worker writes on every successful
-- pairing (llumitaula-worker #13). This migration makes the table concrete in
-- the admin repo's own migration set (idempotent with the worker definition so
-- both can be applied to the shared schema) and exposes a RPC the admin app
-- can call to render the history for one device.
CREATE TABLE IF NOT EXISTS public.device_claims (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id         uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  device_identifier text NOT NULL,
  claimed_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for device-based audit lookups.
CREATE INDEX IF NOT EXISTS idx_device_claims_device_id
  ON public.device_claims (device_id);

-- History is only readable through the RPC below; direct table access is
-- locked down the same way the worker locks it.
ALTER TABLE public.device_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_device_claims(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_role text := (select auth.jwt() ->> 'role');
  v_school_id uuid;
BEGIN
  SELECT d.school_id INTO v_school_id
    FROM public.devices d
   WHERE d.id = p_device_id;

  -- Mirror generate_device_config_code access rules: admin is global, a
  -- supervisor only sees their own school's devices. Anything else (unknown
  -- device, another school, non-staff role) raises instead of leaking data.
  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Device not found or not accessible';
  END IF;
  IF v_role <> 'admin'
     AND NOT (v_role = 'supervisor' AND v_school_id = public.current_user_school_id())
  THEN
    RAISE EXCEPTION 'Device not found or not accessible';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',               c.id,
        'device_identifier', c.device_identifier,
        'claimed_at',        c.claimed_at
      ) ORDER BY c.claimed_at DESC, c.id DESC
    )
    FROM public.device_claims c
    WHERE c.device_id = p_device_id
  ), '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_device_claims(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_device_claims(uuid) TO authenticated;