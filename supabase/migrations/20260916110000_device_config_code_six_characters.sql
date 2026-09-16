-- Issue #14 (admin): generate short 6-character config codes, stored as a
-- hash, invalidating any code previously issued for the device.
--
-- The worker's claim flow (llumitaula-worker #13) matches a device code by
-- comparing `encode(digest(lower(code), 'sha256'), 'hex')` against
-- `devices.config_code_hash`, so the code emitted here must hash exactly that
-- way.
--
-- In the shared tenant schema `devices` may already exist (created by the
-- worker base migrations), in which case the admin CREATE TABLE IF NOT EXISTS
-- is a no-op and these columns are never added. Adding them IF NOT EXISTS here
-- makes the column state match the admin table definition regardless of the
-- order the admin migrations ran relative to the worker baseline.
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS config_code_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS config_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.generate_device_config_code(p_device_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_candidate text := '';
BEGIN
  -- Only an admin (any school) or a supervisor of the device's own school may
  -- mint a code. Mirror the access rules declared when the table was created.
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

  -- Six characters drawn uniformly from [0-9A-Za-z]: enough for a human to
  -- read aloud, and the ~57-bit keyspace keeps brute-force guessing lower than
  -- the expired-code window attackers would need. random() lives in pg_catalog
  -- so it stays resolvable with the pinned search_path.
  FOR i IN 1..6 LOOP
    v_candidate := v_candidate || substr(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      ceil(random() * 62)::int,
      1
    );
  END LOOP;

  UPDATE public.devices
  SET config_code_hash = encode(digest(lower(v_candidate), 'sha256'), 'hex'),
      config_code_created_at = now(),
      -- A fresh code retires any claim the previous one was pending against.
      config_code_expires_at = NULL
  WHERE id = p_device_id;

  RETURN v_candidate;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_device_config_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_device_config_code(uuid) TO authenticated;