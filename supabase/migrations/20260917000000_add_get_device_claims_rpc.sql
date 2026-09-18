-- Remote DB drifts from the local migration set: the device_claims table was
-- delivered by the `reconcile_claim_device_model` migration (applied 2026-09-16)
-- but the get_device_claims RPC from 20260916120000_device_claim_history.sql was
-- never applied, leaving a gap that surfaces as PGRST202 on the admin API.
-- This migration backfills the missing RPC on top of the existing table.
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