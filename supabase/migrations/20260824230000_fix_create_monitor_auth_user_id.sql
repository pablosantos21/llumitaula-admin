-- auth.users.id has no default in this environment, so create_monitor must
-- generate the uuid itself instead of relying on RETURNING id.
-- Also keeps pgcrypto's extensions schema in search_path for crypt()/gen_salt().
CREATE OR REPLACE FUNCTION public.create_monitor(p_first_name text, p_last_name text, p_code smallint, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_user_id uuid;
  v_monitor_id uuid;
  v_email text;
  v_password text;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden crear monitores'
      using errcode = '42501';
  end if;

  v_user_id := gen_random_uuid();
  v_email := 'monitor.' || p_code || '@llumitaula.local';
  v_password := p_code::text;

  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, role, aud, raw_app_meta_data, raw_user_meta_data
  ) values (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(v_password, gen_salt('bf')),
    now(),
    now(), now(),
    'authenticated', 'authenticated',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_first_name || ' ' || p_last_name)
  );

  insert into public.users (id, role, full_name, active)
  values (v_user_id, 'monitor', p_first_name || ' ' || p_last_name, true);

  insert into public.monitors (first_name, last_name, code, school_id, user_id)
  values (p_first_name, p_last_name, p_code, p_school_id, v_user_id)
  returning id into v_monitor_id;

  insert into public.monitors_schools (monitor_id, school_id)
  values (v_monitor_id, p_school_id)
  on conflict do nothing;

  return jsonb_build_object(
    'ok', true,
    'monitor_id', v_monitor_id,
    'user_id', v_user_id,
    'email', v_email
  );
end;
$function$;
