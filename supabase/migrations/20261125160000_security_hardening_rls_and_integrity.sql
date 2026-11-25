-- Issue #31: Security hardening, strict active-role/tenant RLS isolation,
-- monitor credential/deletion revocation, cryptographic expiring device codes,
-- device delete policy, and atomic child allergen replacement.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ── 1. Core active-user & tenant-scope helpers ──────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp, auth
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp, auth
AS $$
  SELECT coalesce((SELECT u.active FROM public.users u WHERE u.id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp, auth
AS $$
  SELECT u.role::text
    FROM public.users u
   WHERE u.id = auth.uid()
     AND u.active;
$$;

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp, auth
AS $$
  SELECT u.school_id
    FROM public.users u
   WHERE u.id = auth.uid()
     AND u.active;
$$;

REVOKE ALL ON FUNCTION public.current_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_school_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_school_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_monitor_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.school_id
    FROM public.monitors m
   WHERE public.current_user_active()
     AND m.user_id = public.current_user_id()
     AND m.school_id IS NOT NULL
  UNION
  SELECT ms.school_id
    FROM public.monitors_schools ms
    JOIN public.monitors m ON m.id = ms.monitor_id
   WHERE public.current_user_active()
     AND m.user_id = public.current_user_id();
$$;

CREATE OR REPLACE FUNCTION private.current_user_supervisor_school_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.school_id
    FROM public.users u
   WHERE u.id = public.current_user_id()
     AND u.active
     AND u.role::text = 'supervisor'
     AND u.school_id IS NOT NULL
  UNION
  SELECT a.school_id
    FROM public.school_supervisor_assignments a
    JOIN public.users u ON u.id = a.supervisor_id
   WHERE a.supervisor_id = public.current_user_id()
     AND u.active
     AND u.role::text = 'supervisor';
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_access_school(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND p_school_id IS NOT NULL
     AND (
       public.current_user_role() = 'admin'
       OR (
         public.current_user_role() = 'supervisor'
         AND p_school_id IN (SELECT private.current_user_supervisor_school_ids())
       )
       OR (
         public.current_user_role() = 'monitor'
         AND p_school_id IN (SELECT private.current_user_monitor_school_ids())
       )
       OR (
         public.current_user_role() = 'worker'
         AND EXISTS (
           SELECT 1
             FROM public.worker_classrooms wc
             JOIN public.classes c ON c.id = wc.class_id
            WHERE wc.worker_id = public.current_user_id()
              AND c.school_id = p_school_id
         )
       )
       OR (
         public.current_user_role() = 'parent'
         AND EXISTS (
           SELECT 1
             FROM public.parents_children pc
             JOIN public.children ch ON ch.id = pc.child_id
             JOIN public.classes c ON c.id = ch.class_id
            WHERE pc.parent_id = public.current_user_id()
              AND c.school_id = p_school_id
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_access_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR EXISTS (
         SELECT 1
           FROM public.classes c
          WHERE c.id = p_class_id
            AND (
              (
                public.current_user_role() = 'supervisor'
                AND c.school_id IN (SELECT private.current_user_supervisor_school_ids())
              )
              OR (
                public.current_user_role() = 'monitor'
                AND c.school_id IN (SELECT private.current_user_monitor_school_ids())
              )
              OR (
                public.current_user_role() = 'worker'
                AND EXISTS (
                  SELECT 1
                    FROM public.worker_classrooms wc
                   WHERE wc.class_id = c.id
                     AND wc.worker_id = public.current_user_id()
                )
              )
              OR (
                public.current_user_role() = 'parent'
                AND EXISTS (
                  SELECT 1
                    FROM public.children ch
                    JOIN public.parents_children pc ON pc.child_id = ch.id
                   WHERE ch.class_id = c.id
                     AND pc.parent_id = public.current_user_id()
                )
              )
            )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_access_child(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR EXISTS (
         SELECT 1
           FROM public.children ch
           JOIN public.classes cl ON cl.id = ch.class_id
          WHERE ch.id = p_child_id
            AND (
              (
                public.current_user_role() = 'supervisor'
                AND cl.school_id IN (SELECT private.current_user_supervisor_school_ids())
              )
              OR (
                public.current_user_role() = 'monitor'
                AND cl.school_id IN (SELECT private.current_user_monitor_school_ids())
              )
              OR (
                public.current_user_role() = 'worker'
                AND EXISTS (
                  SELECT 1
                    FROM public.worker_classrooms wc
                   WHERE wc.class_id = cl.id
                     AND wc.worker_id = public.current_user_id()
                )
              )
              OR (
                public.current_user_role() = 'parent'
                AND EXISTS (
                  SELECT 1
                    FROM public.parents_children pc
                   WHERE pc.child_id = ch.id
                     AND pc.parent_id = public.current_user_id()
                )
              )
            )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_manage_child_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR (
         public.current_user_role() = 'supervisor'
         AND EXISTS (
           SELECT 1
             FROM public.classes c
            WHERE c.id = p_class_id
              AND c.school_id IN (SELECT private.current_user_supervisor_school_ids())
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_manage_child(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       (
         public.current_user_role() = 'admin'
         AND EXISTS (SELECT 1 FROM public.children ch WHERE ch.id = p_child_id)
       )
       OR (
         public.current_user_role() = 'supervisor'
         AND EXISTS (
           SELECT 1
             FROM public.children ch
             JOIN public.classes cl ON cl.id = ch.class_id
            WHERE ch.id = p_child_id
              AND cl.school_id IN (SELECT private.current_user_supervisor_school_ids())
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_access_monitor(p_monitor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR (
         public.current_user_role() = 'supervisor'
         AND (
           EXISTS (
             SELECT 1
               FROM public.monitors m
              WHERE m.id = p_monitor_id
                AND m.school_id IN (SELECT private.current_user_supervisor_school_ids())
           )
           OR EXISTS (
             SELECT 1
               FROM public.monitors_schools ms
              WHERE ms.monitor_id = p_monitor_id
                AND ms.school_id IN (SELECT private.current_user_supervisor_school_ids())
           )
         )
       )
       OR (
         public.current_user_role() = 'monitor'
         AND EXISTS (
           SELECT 1
             FROM public.monitors m
            WHERE m.id = p_monitor_id
              AND m.user_id = public.current_user_id()
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_view_user(p_user_id uuid, p_user_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_id() = p_user_id
     OR (
       public.current_user_active()
       AND (
         public.current_user_role() = 'admin'
         OR (
           public.current_user_role() = 'supervisor'
           AND (
             p_user_school_id IN (SELECT private.current_user_supervisor_school_ids())
             OR EXISTS (
               SELECT 1
                 FROM public.monitors m
                WHERE m.user_id = p_user_id
                  AND m.school_id IN (SELECT private.current_user_supervisor_school_ids())
             )
             OR EXISTS (
               SELECT 1
                 FROM public.monitors m
                 JOIN public.monitors_schools ms ON ms.monitor_id = m.id
                WHERE m.user_id = p_user_id
                  AND ms.school_id IN (SELECT private.current_user_supervisor_school_ids())
             )
           )
         )
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.current_user_can_access_menu(p_menu_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR EXISTS (
         SELECT 1
           FROM public.menus_schools ms
          WHERE ms.menu_id = p_menu_id
            AND private.current_user_can_access_school(ms.school_id)
       )
     );
$$;

CREATE OR REPLACE FUNCTION private.child_belongs_to_school(p_child_id uuid, p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.children ch
      JOIN public.classes cl ON cl.id = ch.class_id
     WHERE ch.id = p_child_id
       AND cl.school_id = p_school_id
  );
$$;

CREATE OR REPLACE FUNCTION private.child_and_class_belong_to_school(
  p_child_id uuid,
  p_class_id uuid,
  p_school_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.classes cl
     WHERE cl.id = p_class_id
       AND cl.school_id = p_school_id
  )
  AND EXISTS (
    SELECT 1
      FROM public.children ch
      JOIN public.classes ccl ON ccl.id = ch.class_id
     WHERE ch.id = p_child_id
       AND ccl.school_id = p_school_id
  );
$$;

REVOKE ALL ON FUNCTION private.current_user_monitor_school_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_supervisor_school_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_access_school(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_access_class(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_access_child(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_manage_child_class(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_manage_child(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_access_monitor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_view_user(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_can_access_menu(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.child_belongs_to_school(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.child_and_class_belong_to_school(uuid, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.current_user_monitor_school_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_supervisor_school_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_school(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_manage_child_class(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_manage_child(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_monitor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_view_user(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_access_menu(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.child_belongs_to_school(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.child_and_class_belong_to_school(uuid, uuid, uuid) TO authenticated;

-- ── 2. JWT custom_access_token_hook & public.users privilege protection ────

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  claims jsonb := coalesce(event->'claims', '{}'::jsonb);
  profile_role public.user_role;
  profile_school_id uuid;
  profile_active boolean;
BEGIN
  SELECT u.role, u.school_id, u.active
    INTO profile_role, profile_school_id, profile_active
    FROM public.users u
   WHERE u.id = (event->>'user_id')::uuid;

  IF profile_active IS TRUE THEN
    claims := jsonb_set(claims, '{role}', coalesce(to_jsonb(profile_role), 'null'::jsonb), true);
    claims := jsonb_set(claims, '{school_id}', coalesce(to_jsonb(profile_school_id), 'null'::jsonb), true);
    claims := jsonb_set(claims, '{active}', 'true'::jsonb, true);
  ELSE
    claims := jsonb_set(claims, '{role}', 'null'::jsonb, true);
    claims := jsonb_set(claims, '{school_id}', 'null'::jsonb, true);
    claims := jsonb_set(claims, '{active}', 'false'::jsonb, true);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp, auth
AS $$
DECLARE
  v_role_setting text := coalesce(current_setting('role', true), '');
  v_is_active_admin boolean;
BEGIN
  -- Privileged backend roles (postgres, service_role, supabase_admin, migrations)
  -- are outside authenticated/anon client requests.
  IF v_role_setting NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  v_is_active_admin := public.current_user_active()
    AND public.current_user_role() = 'admin';

  IF v_is_active_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.role IS DISTINCT FROM 'parent'::public.user_role
       OR NEW.school_id IS NOT NULL
       OR NEW.active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Only active administrators can assign role, school_id, or active status'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role
       OR OLD.school_id IS DISTINCT FROM NEW.school_id
       OR OLD.active IS DISTINCT FROM NEW.active THEN
      RAISE EXCEPTION 'Only active administrators can modify role, school_id, or active status'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_supervisor_role_escalation ON public.users;
DROP FUNCTION IF EXISTS public.prevent_supervisor_role_escalation();
DROP TRIGGER IF EXISTS prevent_user_privilege_escalation ON public.users;
CREATE TRIGGER prevent_user_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_privilege_escalation();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users TO authenticated;

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
DROP POLICY IF EXISTS "users_insert" ON public.users;
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_select_workers" ON public.users;
DROP POLICY IF EXISTS "users_admin_select" ON public.users;
DROP POLICY IF EXISTS "users_update" ON public.users;
DROP POLICY IF EXISTS "users_update_workers" ON public.users;
DROP POLICY IF EXISTS "users_delete" ON public.users;

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (private.current_user_can_view_user(id, school_id));

CREATE POLICY users_insert ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.current_user_active() AND public.current_user_role() = 'admin')
    OR (
      (select auth.uid()) = id
      AND role = 'parent'::public.user_role
      AND school_id IS NULL
      AND active = true
    )
  );

CREATE POLICY users_update ON public.users
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (select auth.uid()) = id
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
        AND role::text IN ('monitor', 'worker')
      )
    )
  )
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        (select auth.uid()) = id
        AND role::text = public.current_user_role()
        AND school_id IS NOT DISTINCT FROM public.current_user_school_id()
        AND active = true
      )
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
        AND role::text IN ('monitor', 'worker')
      )
    )
  );

CREATE POLICY users_delete ON public.users
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- ── 3. Monitors: RLS isolation, hide `code`, secure create & delete RPCs ────

ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitors_schools ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.monitors FROM PUBLIC, anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.monitors TO authenticated;

-- Grant column-level SELECT on public.monitors for every column EXCEPT `code`,
-- preventing authenticated callers from reading plaintext monitor PINs.
DO $$
DECLARE
  v_cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'monitors'
     AND column_name <> 'code';

  IF v_cols IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON TABLE public.monitors TO authenticated', v_cols);
  END IF;
END $$;

REVOKE ALL ON TABLE public.monitors_schools FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.monitors_schools TO authenticated;

DROP POLICY IF EXISTS "monitors_select" ON public.monitors;
DROP POLICY IF EXISTS "monitors_insert" ON public.monitors;
DROP POLICY IF EXISTS "monitors_update" ON public.monitors;
DROP POLICY IF EXISTS "monitors_delete" ON public.monitors;

CREATE POLICY monitors_select ON public.monitors
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_monitor(id));

CREATE POLICY monitors_insert ON public.monitors
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY monitors_update ON public.monitors
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND private.current_user_can_access_monitor(id)
      )
    )
  )
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY monitors_delete ON public.monitors
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "monitors_schools_select" ON public.monitors_schools;
DROP POLICY IF EXISTS "monitors_schools_insert" ON public.monitors_schools;
DROP POLICY IF EXISTS "monitors_schools_update" ON public.monitors_schools;
DROP POLICY IF EXISTS "monitors_schools_delete" ON public.monitors_schools;

CREATE POLICY monitors_schools_select ON public.monitors_schools
  FOR SELECT TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
      OR (
        public.current_user_role() = 'monitor'
        AND private.current_user_can_access_monitor(monitor_id)
      )
    )
  );

CREATE POLICY monitors_schools_insert ON public.monitors_schools
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY monitors_schools_update ON public.monitors_schools
  FOR UPDATE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY monitors_schools_delete ON public.monitors_schools
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- Hardened create_monitor: never uses the 3-4 digit PIN as the auth.users password.
CREATE OR REPLACE FUNCTION public.create_monitor(
  p_first_name text,
  p_last_name text,
  p_code smallint,
  p_school_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
  v_monitor_id uuid;
  v_slug text;
  v_base text;
  v_email text;
  v_password text;
  v_n int;
BEGIN
  IF NOT public.current_user_active()
     OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden crear monitores'
      USING ERRCODE = '42501';
  END IF;

  v_slug := translate(
    lower(
      replace(btrim(p_first_name), ' ', '.') || '.' ||
      replace(btrim(p_last_name), ' ', '.')
    ),
    'áàäâãéèëêíìïîóòöôõúùüûñç',
    'aaaaaeeeeiiiiooooouuuunc'
  );

  v_base := v_slug;
  v_email := v_base || '@llumitaula.local';
  v_n := 1;
  WHILE EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email)) LOOP
    v_n := v_n + 1;
    v_email := v_base || v_n::text || '@llumitaula.local';
  END LOOP;

  v_user_id := gen_random_uuid();
  -- Use a high-entropy random secret for auth.users instead of the plaintext PIN.
  v_password := encode(extensions.gen_random_bytes(24), 'base64');

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, role, aud, raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    now(),
    now(), now(),
    'authenticated', 'authenticated',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_first_name || ' ' || p_last_name)
  );

  INSERT INTO public.users (id, role, school_id, full_name, active)
  VALUES (v_user_id, 'monitor', p_school_id, p_first_name || ' ' || p_last_name, true);

  INSERT INTO public.monitors (first_name, last_name, code, school_id, user_id)
  VALUES (p_first_name, p_last_name, p_code, p_school_id, v_user_id)
  RETURNING id INTO v_monitor_id;

  INSERT INTO public.monitors_schools (monitor_id, school_id)
  VALUES (v_monitor_id, p_school_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'monitor_id', v_monitor_id,
    'user_id', v_user_id,
    'email', v_email
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_monitor(text, text, smallint, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_monitor(text, text, smallint, uuid) TO authenticated;

-- Atomic monitor deletion that also revokes public.users and auth.users access.
CREATE OR REPLACE FUNCTION public.delete_monitor(p_monitor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.current_user_active()
     OR public.current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Solo los administradores pueden eliminar monitores'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.user_id
    INTO v_user_id
    FROM public.monitors m
   WHERE m.id = p_monitor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Monitor no encontrado'
      USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.monitors_schools WHERE monitor_id = p_monitor_id;
  DELETE FROM public.monitors WHERE id = p_monitor_id;

  IF v_user_id IS NOT NULL THEN
    UPDATE public.users
       SET active = false
     WHERE id = v_user_id;

    DELETE FROM auth.refresh_tokens WHERE user_id = v_user_id::text;
    DELETE FROM auth.sessions WHERE user_id = v_user_id;

    UPDATE auth.users
       SET banned_until = 'infinity'::timestamptz,
           encrypted_password = extensions.crypt(
             encode(extensions.gen_random_bytes(24), 'base64'),
             extensions.gen_salt('bf')
           ),
           updated_at = now()
     WHERE id = v_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_monitor(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.delete_monitor(uuid) TO authenticated;

-- ── 4. Strict active-role & tenant RLS on core domain tables ───────────────

-- schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.schools FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schools TO authenticated;

DROP POLICY IF EXISTS schools_select ON public.schools;
DROP POLICY IF EXISTS schools_supervisor_select ON public.schools;
DROP POLICY IF EXISTS schools_existing_select ON public.schools;
DROP POLICY IF EXISTS schools_select_assigned_capability_supervisors ON public.schools;
DROP POLICY IF EXISTS schools_insert ON public.schools;
DROP POLICY IF EXISTS schools_update ON public.schools;
DROP POLICY IF EXISTS schools_delete ON public.schools;

CREATE POLICY schools_select ON public.schools
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_school(id));

CREATE POLICY schools_insert ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY schools_update ON public.schools
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  )
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY schools_delete ON public.schools
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.classes FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.classes TO authenticated;

DROP POLICY IF EXISTS classes_select ON public.classes;
DROP POLICY IF EXISTS classes_supervisor_select ON public.classes;
DROP POLICY IF EXISTS classes_related_select ON public.classes;
DROP POLICY IF EXISTS classes_select_capability_relationships ON public.classes;
DROP POLICY IF EXISTS classes_select_assigned_supervisors ON public.classes;
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;

CREATE POLICY classes_select ON public.classes
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_class(id));

CREATE POLICY classes_insert ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY classes_update ON public.classes
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  )
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY classes_delete ON public.classes
  FOR DELETE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

-- children
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.children FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.children TO authenticated;

DROP POLICY IF EXISTS children_select ON public.children;
DROP POLICY IF EXISTS children_supervisor_select ON public.children;
DROP POLICY IF EXISTS children_related_select ON public.children;
DROP POLICY IF EXISTS children_insert ON public.children;
DROP POLICY IF EXISTS children_update ON public.children;
DROP POLICY IF EXISTS children_delete ON public.children;
DROP POLICY IF EXISTS children_admin_insert ON public.children;
DROP POLICY IF EXISTS children_admin_update ON public.children;
DROP POLICY IF EXISTS children_admin_delete ON public.children;

CREATE POLICY children_select ON public.children
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_child(id));

CREATE POLICY children_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (private.current_user_can_manage_child_class(class_id));

CREATE POLICY children_update ON public.children
  FOR UPDATE TO authenticated
  USING (private.current_user_can_manage_child_class(class_id))
  WITH CHECK (private.current_user_can_manage_child_class(class_id));

CREATE POLICY children_delete ON public.children
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- child_allergens
ALTER TABLE public.child_allergens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.child_allergens FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.child_allergens TO authenticated;

DROP POLICY IF EXISTS child_allergens_select ON public.child_allergens;
DROP POLICY IF EXISTS child_allergens_insert ON public.child_allergens;
DROP POLICY IF EXISTS child_allergens_update ON public.child_allergens;
DROP POLICY IF EXISTS child_allergens_delete ON public.child_allergens;

CREATE POLICY child_allergens_select ON public.child_allergens
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_child(child_id));

CREATE POLICY child_allergens_insert ON public.child_allergens
  FOR INSERT TO authenticated
  WITH CHECK (private.current_user_can_manage_child(child_id));

CREATE POLICY child_allergens_update ON public.child_allergens
  FOR UPDATE TO authenticated
  USING (private.current_user_can_manage_child(child_id))
  WITH CHECK (private.current_user_can_manage_child(child_id));

CREATE POLICY child_allergens_delete ON public.child_allergens
  FOR DELETE TO authenticated
  USING (private.current_user_can_manage_child(child_id));

-- allergens
DO $$
BEGIN
  IF to_regclass('public.allergens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public.allergens FROM PUBLIC, anon';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.allergens TO authenticated';
    EXECUTE 'DROP POLICY IF EXISTS allergens_select ON public.allergens';
    EXECUTE 'DROP POLICY IF EXISTS allergens_insert ON public.allergens';
    EXECUTE 'DROP POLICY IF EXISTS allergens_update ON public.allergens';
    EXECUTE 'DROP POLICY IF EXISTS allergens_delete ON public.allergens';
    EXECUTE 'CREATE POLICY allergens_select ON public.allergens FOR SELECT TO authenticated USING (public.current_user_active())';
    EXECUTE 'CREATE POLICY allergens_insert ON public.allergens FOR INSERT TO authenticated WITH CHECK (public.current_user_active() AND public.current_user_role() = ''admin'')';
    EXECUTE 'CREATE POLICY allergens_update ON public.allergens FOR UPDATE TO authenticated USING (public.current_user_active() AND public.current_user_role() = ''admin'') WITH CHECK (public.current_user_active() AND public.current_user_role() = ''admin'')';
    EXECUTE 'CREATE POLICY allergens_delete ON public.allergens FOR DELETE TO authenticated USING (public.current_user_active() AND public.current_user_role() = ''admin'')';
  END IF;
END $$;

-- parents_children
ALTER TABLE public.parents_children ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.parents_children FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.parents_children TO authenticated;

DROP POLICY IF EXISTS parents_children_select ON public.parents_children;
DROP POLICY IF EXISTS parents_children_insert ON public.parents_children;
DROP POLICY IF EXISTS parents_children_update ON public.parents_children;
DROP POLICY IF EXISTS parents_children_delete ON public.parents_children;

CREATE POLICY parents_children_select ON public.parents_children
  FOR SELECT TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR parent_id = public.current_user_id()
      OR (
        public.current_user_role() IN ('supervisor', 'monitor', 'worker')
        AND private.current_user_can_access_child(child_id)
      )
    )
  );

CREATE POLICY parents_children_insert ON public.parents_children
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY parents_children_update ON public.parents_children
  FOR UPDATE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY parents_children_delete ON public.parents_children
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- incidents
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.incidents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.incidents TO authenticated;

DROP POLICY IF EXISTS incidents_select ON public.incidents;
DROP POLICY IF EXISTS incidents_insert ON public.incidents;
DROP POLICY IF EXISTS incidents_update ON public.incidents;
DROP POLICY IF EXISTS incidents_delete ON public.incidents;

CREATE POLICY incidents_select ON public.incidents
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_child(child_id));

CREATE POLICY incidents_insert ON public.incidents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() IN ('supervisor', 'monitor', 'worker')
        AND private.current_user_can_access_child(child_id)
      )
    )
  );

CREATE POLICY incidents_update ON public.incidents
  FOR UPDATE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY incidents_delete ON public.incidents
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- menus
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menus FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.menus TO authenticated;

DROP POLICY IF EXISTS menus_select ON public.menus;
DROP POLICY IF EXISTS menus_insert ON public.menus;
DROP POLICY IF EXISTS menus_update ON public.menus;
DROP POLICY IF EXISTS menus_delete ON public.menus;

CREATE POLICY menus_select ON public.menus
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_menu(id));

CREATE POLICY menus_insert ON public.menus
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY menus_update ON public.menus
  FOR UPDATE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY menus_delete ON public.menus
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- menus_schools
ALTER TABLE public.menus_schools ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.menus_schools FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.menus_schools TO authenticated;

DROP POLICY IF EXISTS menus_schools_select ON public.menus_schools;
DROP POLICY IF EXISTS menus_schools_insert ON public.menus_schools;
DROP POLICY IF EXISTS menus_schools_update ON public.menus_schools;
DROP POLICY IF EXISTS menus_schools_delete ON public.menus_schools;

CREATE POLICY menus_schools_select ON public.menus_schools
  FOR SELECT TO authenticated
  USING (private.current_user_can_access_school(school_id));

CREATE POLICY menus_schools_insert ON public.menus_schools
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY menus_schools_update ON public.menus_schools
  FOR UPDATE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_active() AND public.current_user_role() = 'admin');

CREATE POLICY menus_schools_delete ON public.menus_schools
  FOR DELETE TO authenticated
  USING (public.current_user_active() AND public.current_user_role() = 'admin');

-- daily_attendance: verify child_id & class_id belong to school_id
DROP POLICY IF EXISTS daily_attendance_select ON public.daily_attendance;
DROP POLICY IF EXISTS daily_attendance_insert ON public.daily_attendance;
DROP POLICY IF EXISTS daily_attendance_update ON public.daily_attendance;
DROP POLICY IF EXISTS daily_attendance_delete ON public.daily_attendance;

CREATE POLICY daily_attendance_select ON public.daily_attendance
  FOR SELECT TO authenticated
  USING (private.current_user_can_read_daily_attendance(school_id));

CREATE POLICY daily_attendance_insert ON public.daily_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_manage_daily_attendance(school_id)
    AND private.child_and_class_belong_to_school(child_id, class_id, school_id)
    AND confirmed_by = public.current_user_id()
    AND confirmed_at <= now()
  );

CREATE POLICY daily_attendance_update ON public.daily_attendance
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_daily_attendance(school_id))
  WITH CHECK (
    public.current_user_can_manage_daily_attendance(school_id)
    AND private.child_and_class_belong_to_school(child_id, class_id, school_id)
    AND confirmed_by = public.current_user_id()
    AND confirmed_at <= now()
  );

CREATE POLICY daily_attendance_delete ON public.daily_attendance
  FOR DELETE TO authenticated
  USING (public.current_user_can_manage_daily_attendance(school_id));

CREATE OR REPLACE FUNCTION public.enforce_daily_attendance_school_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.child_and_class_belong_to_school(NEW.child_id, NEW.class_id, NEW.school_id) THEN
    RAISE EXCEPTION 'child_id and class_id must belong to school_id'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_daily_attendance_school_membership ON public.daily_attendance;
CREATE TRIGGER enforce_daily_attendance_school_membership
  AFTER INSERT OR UPDATE ON public.daily_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_daily_attendance_school_membership();

-- child_lunch_days: verify child_id belongs to school_id
DROP POLICY IF EXISTS child_lunch_days_select ON public.child_lunch_days;
DROP POLICY IF EXISTS child_lunch_days_insert ON public.child_lunch_days;
DROP POLICY IF EXISTS child_lunch_days_update ON public.child_lunch_days;
DROP POLICY IF EXISTS child_lunch_days_delete ON public.child_lunch_days;

CREATE POLICY child_lunch_days_select ON public.child_lunch_days
  FOR SELECT TO authenticated
  USING (private.current_user_can_read_child_lunch_days(school_id));

CREATE POLICY child_lunch_days_insert ON public.child_lunch_days
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_manage_child_lunch_days(school_id)
    AND private.child_belongs_to_school(child_id, school_id)
  );

CREATE POLICY child_lunch_days_update ON public.child_lunch_days
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_child_lunch_days(school_id))
  WITH CHECK (
    public.current_user_can_manage_child_lunch_days(school_id)
    AND private.child_belongs_to_school(child_id, school_id)
  );

CREATE POLICY child_lunch_days_delete ON public.child_lunch_days
  FOR DELETE TO authenticated
  USING (public.current_user_can_manage_child_lunch_days(school_id));

CREATE OR REPLACE FUNCTION public.enforce_child_lunch_days_school_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.child_belongs_to_school(NEW.child_id, NEW.school_id) THEN
    RAISE EXCEPTION 'child_id must belong to school_id'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_child_lunch_days_school_membership ON public.child_lunch_days;
CREATE TRIGGER enforce_child_lunch_days_school_membership
  AFTER INSERT OR UPDATE ON public.child_lunch_days
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_child_lunch_days_school_membership();

-- meal_history view: enforce security_invoker = true so underlying RLS applies
DO $$
BEGIN
  IF to_regclass('public.meal_history') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.meal_history SET (security_invoker = true)';
  END IF;
END $$;

-- ── 5. Devices: cryptographic expiring config codes & DELETE RLS policy ────

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.devices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.devices TO authenticated;

DROP POLICY IF EXISTS staff_read_devices ON public.devices;
DROP POLICY IF EXISTS devices_select ON public.devices;
DROP POLICY IF EXISTS devices_insert ON public.devices;
DROP POLICY IF EXISTS devices_update ON public.devices;
DROP POLICY IF EXISTS devices_delete ON public.devices;

CREATE POLICY devices_select ON public.devices
  FOR SELECT TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY devices_insert ON public.devices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY devices_update ON public.devices
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  )
  WITH CHECK (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE POLICY devices_delete ON public.devices
  FOR DELETE TO authenticated
  USING (
    public.current_user_active()
    AND (
      public.current_user_role() = 'admin'
      OR (
        public.current_user_role() = 'supervisor'
        AND school_id IN (SELECT private.current_user_supervisor_school_ids())
      )
    )
  );

CREATE OR REPLACE FUNCTION public.generate_device_config_code(p_device_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_alphabet CONSTANT text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  v_code_length CONSTANT int := 6;
  v_candidate text := '';
  v_bytes bytea;
  v_byte int;
  v_pos int;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.devices d
     WHERE d.id = p_device_id
       AND d.active
       AND public.current_user_active()
       AND (
         public.current_user_role() = 'admin'
         OR (
           public.current_user_role() = 'supervisor'
           AND d.school_id IN (SELECT private.current_user_supervisor_school_ids())
         )
       )
  ) THEN
    RAISE EXCEPTION 'Device not found, inactive, or not accessible';
  END IF;

  -- Draw 6 characters uniformly from 36 case-insensitive symbols using
  -- cryptographic randomness (gen_random_bytes) with rejection sampling
  -- (252 = 7 * 36) to avoid modulo bias and zero-index truncation.
  WHILE length(v_candidate) < v_code_length LOOP
    v_bytes := extensions.gen_random_bytes(16);
    FOR v_pos IN 0..15 LOOP
      EXIT WHEN length(v_candidate) >= v_code_length;
      v_byte := get_byte(v_bytes, v_pos);
      IF v_byte < 252 THEN
        v_candidate := v_candidate || substr(v_alphabet, (v_byte % 36) + 1, 1);
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.devices
     SET config_code_hash = encode(extensions.digest(lower(v_candidate), 'sha256'), 'hex'),
         config_code_created_at = now(),
         config_code_expires_at = now() + interval '15 minutes'
   WHERE id = p_device_id;

  RETURN v_candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_device_config_code(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.generate_device_config_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_device_claims(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  SELECT d.school_id INTO v_school_id
    FROM public.devices d
   WHERE d.id = p_device_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Device not found or not accessible';
  END IF;

  IF NOT public.current_user_active()
     OR (
       public.current_user_role() IS DISTINCT FROM 'admin'
       AND NOT (
         public.current_user_role() = 'supervisor'
         AND v_school_id IN (SELECT private.current_user_supervisor_school_ids())
       )
     ) THEN
    RAISE EXCEPTION 'Device not found or not accessible';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',                c.id,
        'device_identifier', c.device_identifier,
        'claimed_at',        c.claimed_at
      ) ORDER BY c.claimed_at DESC, c.id DESC
    )
    FROM public.device_claims c
    WHERE c.device_id = p_device_id
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_device_claims(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_device_claims(uuid) TO authenticated;

-- ── 6. Atomic replacement of child allergens ───────────────────────────────

CREATE OR REPLACE FUNCTION public.set_child_allergens(
  p_child_id uuid,
  p_allergen_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'set_child_allergens requires a child id'
      USING ERRCODE = '22023';
  END IF;

  IF NOT private.current_user_can_manage_child(p_child_id) THEN
    RAISE EXCEPTION 'Child not found or not accessible'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.child_allergens
   WHERE child_id = p_child_id;

  IF p_allergen_ids IS NOT NULL AND cardinality(p_allergen_ids) > 0 THEN
    INSERT INTO public.child_allergens (child_id, allergen_id)
    SELECT DISTINCT p_child_id, a.allergen_id
      FROM unnest(p_allergen_ids) AS a(allergen_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_child_allergens(uuid, uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.set_child_allergens(uuid, uuid[]) TO authenticated;
