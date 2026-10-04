-- Contract tests for the school/class capability settings and the authorized
-- family/monitor effective-settings RPC.
--
-- Run through scripts/test-db.sh. All mutations are rolled back.

BEGIN;

SELECT plan(127);

SET LOCAL ROLE postgres;

INSERT INTO public.schools (id, name) VALUES
  ('00000000-0000-4000-8000-000000000201'::uuid, 'School A'),
  ('00000000-0000-4000-8000-000000000202'::uuid, 'School B');

INSERT INTO public.users (id, role, full_name, active) VALUES
  ('00000000-0000-4000-8000-000000000101'::uuid, 'admin', 'Admin', true),
  ('00000000-0000-4000-8000-000000000102'::uuid, 'supervisor', 'Supervisor', true),
  ('00000000-0000-4000-8000-000000000103'::uuid, 'supervisor', 'Unassigned Supervisor', true),
  -- Parent access comes from child/class relationships, not users.school_id.
  ('00000000-0000-4000-8000-000000000104'::uuid, 'parent', 'Parent A', true),
  ('00000000-0000-4000-8000-000000000105'::uuid, 'parent', 'Parent B', true),
  ('00000000-0000-4000-8000-000000000106'::uuid, 'monitor', 'Monitor A', true),
  ('00000000-0000-4000-8000-000000000107'::uuid, 'monitor', 'Monitor B', true),
  ('00000000-0000-4000-8000-000000000108'::uuid, 'parent', 'Inactive Parent', false),
  ('00000000-0000-4000-8000-000000000109'::uuid, 'padre', 'Legacy Padre', true),
  ('00000000-0000-4000-8000-000000000110'::uuid, 'worker', 'Worker A', true);

INSERT INTO public.classes (id, name, school_id) VALUES
  ('00000000-0000-4000-8000-000000000301'::uuid, 'Aula A1', '00000000-0000-4000-8000-000000000201'::uuid),
  ('00000000-0000-4000-8000-000000000302'::uuid, 'Aula A2', '00000000-0000-4000-8000-000000000201'::uuid),
  ('00000000-0000-4000-8000-000000000303'::uuid, 'Aula B1', '00000000-0000-4000-8000-000000000202'::uuid);

INSERT INTO public.children (id, class_id, name) VALUES
  ('00000000-0000-4000-8000-000000000401'::uuid, '00000000-0000-4000-8000-000000000301'::uuid, 'Child A1'),
  ('00000000-0000-4000-8000-000000000402'::uuid, '00000000-0000-4000-8000-000000000302'::uuid, 'Child A2'),
  ('00000000-0000-4000-8000-000000000403'::uuid, '00000000-0000-4000-8000-000000000303'::uuid, 'Child B1');

INSERT INTO public.parents_children (parent_id, child_id) VALUES
  ('00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000401'::uuid),
  ('00000000-0000-4000-8000-000000000104'::uuid, '00000000-0000-4000-8000-000000000402'::uuid),
  ('00000000-0000-4000-8000-000000000109'::uuid, '00000000-0000-4000-8000-000000000401'::uuid),
  ('00000000-0000-4000-8000-000000000105'::uuid, '00000000-0000-4000-8000-000000000403'::uuid);

INSERT INTO public.worker_classrooms (worker_id, class_id) VALUES
  ('00000000-0000-4000-8000-000000000110'::uuid, '00000000-0000-4000-8000-000000000301'::uuid);

INSERT INTO public.monitors (id, user_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000701'::uuid, '00000000-0000-4000-8000-000000000106'::uuid, '00000000-0000-4000-8000-000000000201'::uuid),
  ('00000000-0000-4000-8000-000000000702'::uuid, '00000000-0000-4000-8000-000000000107'::uuid, '00000000-0000-4000-8000-000000000202'::uuid);

INSERT INTO public.monitors_schools (monitor_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000701'::uuid, '00000000-0000-4000-8000-000000000201'::uuid),
  ('00000000-0000-4000-8000-000000000702'::uuid, '00000000-0000-4000-8000-000000000202'::uuid);

SELECT has_table('public', 'capability_catalog', 'the database capability catalog exists');
SELECT has_table('public', 'school_capabilities', 'school capability persistence exists');
SELECT has_table('public', 'class_capability_overrides', 'class override persistence exists');
SELECT has_table('public', 'school_supervisor_assignments', 'explicit supervisor-to-school assignments persist');
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.capability_catalog'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.school_capabilities'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.class_capability_overrides'::regclass)
  AND (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.school_supervisor_assignments'::regclass),
  'capability catalog and persistence tables have RLS enabled'
);
SELECT ok(
  has_table_privilege('authenticated', 'public.capability_catalog', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.capability_catalog', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.capability_catalog', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.capability_catalog', 'DELETE')
  AND NOT EXISTS (
    SELECT 1
      FROM (VALUES
        ('public.school_capabilities'),
        ('public.class_capability_overrides'),
        ('public.school_supervisor_assignments')
      ) AS capability_tables(table_name)
      CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) AS table_ops(operation)
     WHERE NOT has_table_privilege('authenticated', capability_tables.table_name, table_ops.operation)
  )
  AND NOT EXISTS (
    SELECT 1
      FROM (VALUES
        ('public.capability_catalog'),
        ('public.school_capabilities'),
        ('public.class_capability_overrides'),
        ('public.school_supervisor_assignments')
      ) AS capability_tables(table_name)
     WHERE has_table_privilege('anon', capability_tables.table_name, 'SELECT')
  ),
  'authenticated callers have SELECT-only catalog access and RLS-gated persistence privileges, while anon cannot read the tables'
);
SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('capability_catalog', 'school_capabilities', 'class_capability_overrides', 'school_supervisor_assignments')
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 13
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'capability_catalog'
       AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  ),
  'the catalog has only its scoped SELECT policy while persistence tables retain their RLS policies'
);
SELECT ok(
  (SELECT bool_and(default_enabled) FROM public.capability_catalog)
  AND (SELECT count(*) FROM public.capability_catalog) = 3,
  'initial catalog defaults are all enabled and use the fixed initial key set'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_effective_capabilities(uuid,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.get_effective_capabilities(uuid,uuid)', 'EXECUTE'),
  'effective capability reads are available only to authenticated callers'
);
SELECT ok(
  has_function_privilege('authenticated', 'private.assert_capability_key(text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'private.assert_capability_key(text)', 'EXECUTE'),
  'fixed-key validation is available only to authenticated invoker RPCs'
);
SELECT ok(
  (SELECT bool_and(NOT p.prosecdef)
     FROM pg_proc p
    WHERE p.oid IN (
      'public.get_capability_settings(uuid)'::regprocedure::oid,
      'public.get_effective_capabilities(uuid,uuid)'::regprocedure::oid,
      'public.set_school_capability(uuid,text,boolean)'::regprocedure::oid,
      'public.set_class_capability(uuid,text,boolean)'::regprocedure::oid,
      'public.reset_class_capability(uuid,text)'::regprocedure::oid,
      'public.get_school_supervisor_assignments(uuid)'::regprocedure::oid,
      'public.set_school_supervisor_assignment(uuid,uuid,boolean)'::regprocedure::oid
    )),
  'all public capability and supervisor-assignment RPCs execute as SECURITY INVOKER'
);
SELECT ok(
  has_function_privilege('authenticated', 'private.current_user_can_read_capability_class(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'private.current_user_can_read_capability_class(uuid)', 'EXECUTE')
  AND (SELECT p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
         FROM pg_proc p
        WHERE p.oid = 'private.current_user_can_read_capability_class(uuid)'::regprocedure),
  'the class RLS predicate is a fixed-search-path SECURITY DEFINER helper restricted to authenticated'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.get_school_supervisor_assignments(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.set_school_supervisor_assignment(uuid,uuid,boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_school_supervisor_assignment(uuid,uuid,boolean)', 'EXECUTE'),
  'supervisor assignment management RPCs require authenticated authorization'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);

-- Exercise each table's real RLS write path as a global administrator. Keep a
-- School B school value and class override as cross-tenant denial fixtures.
INSERT INTO public.school_capabilities (school_id, capability, enabled) VALUES
  ('00000000-0000-4000-8000-000000000202'::uuid, 'family_meal_records', false);
SELECT is(
  (WITH changed AS (
    UPDATE public.school_capabilities SET enabled = false
     WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid
       AND capability = 'family_meal_records'
     RETURNING 1
  ) SELECT count(*) FROM changed),
  1::bigint,
  'admin can directly update a school capability through RLS'
);
INSERT INTO public.school_capabilities (school_id, capability, enabled) VALUES
  ('00000000-0000-4000-8000-000000000202'::uuid, 'monitor_daily_summary', false);
SELECT is(
  (WITH removed AS (
    DELETE FROM public.school_capabilities
     WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid
       AND capability = 'monitor_daily_summary'
     RETURNING 1
  ) SELECT count(*) FROM removed),
  1::bigint,
  'admin can directly delete a school capability through RLS'
);

INSERT INTO public.class_capability_overrides (class_id, capability, enabled) VALUES
  ('00000000-0000-4000-8000-000000000303'::uuid, 'family_meal_records', false);
SELECT is(
  (WITH changed AS (
    UPDATE public.class_capability_overrides SET enabled = false
     WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid
       AND capability = 'family_meal_records'
     RETURNING 1
  ) SELECT count(*) FROM changed),
  1::bigint,
  'admin can directly update a class override through RLS'
);
INSERT INTO public.class_capability_overrides (class_id, capability, enabled) VALUES
  ('00000000-0000-4000-8000-000000000303'::uuid, 'monitor_daily_summary', false);
SELECT is(
  (WITH removed AS (
    DELETE FROM public.class_capability_overrides
     WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid
       AND capability = 'monitor_daily_summary'
     RETURNING 1
  ) SELECT count(*) FROM removed),
  1::bigint,
  'admin can directly delete a class override through RLS'
);

SELECT throws_ok(
  $$INSERT INTO public.capability_catalog (capability, default_enabled)
    VALUES ('temporary_catalog_test', true)$$,
  '42501',
  'an authenticated admin cannot insert a migration-maintained catalog key'
);
SELECT throws_ok(
  $$UPDATE public.capability_catalog SET default_enabled = false
     WHERE capability = 'family_meal_records'$$,
  '42501',
  'an authenticated admin cannot update global catalog defaults'
);
SELECT throws_ok(
  $$DELETE FROM public.capability_catalog WHERE capability = 'family_meal_records'$$,
  '42501',
  'an authenticated admin cannot delete a migration-maintained catalog key'
);

INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id)
VALUES ('00000000-0000-4000-8000-000000000202'::uuid, '00000000-0000-4000-8000-000000000103'::uuid);
UPDATE public.school_supervisor_assignments
   SET supervisor_id = '00000000-0000-4000-8000-000000000103'::uuid
 WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid;
DELETE FROM public.school_supervisor_assignments
 WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid
   AND supervisor_id = '00000000-0000-4000-8000-000000000103'::uuid;
SELECT is(
  (SELECT count(*) FROM public.school_supervisor_assignments
    WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'admin direct assignment insert, update, and delete are scoped by RLS'
);

SELECT is(
  (SELECT count(*) FROM public.schools),
  2::bigint,
  'admins retain their existing school SELECT access'
);
SELECT is(
  (SELECT count(*) FROM public.get_school_supervisor_assignments('00000000-0000-4000-8000-000000000201'::uuid)),
  2::bigint,
  'admin can list existing supervisor users for a school'
);
SELECT is(
  (SELECT assigned FROM public.get_school_supervisor_assignments('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE supervisor_id = '00000000-0000-4000-8000-000000000103'::uuid),
  false,
  'a supervisor starts unassigned'
);
SELECT public.set_school_supervisor_assignment(
  '00000000-0000-4000-8000-000000000201'::uuid,
  '00000000-0000-4000-8000-000000000102'::uuid,
  true
);
SELECT is(
  (SELECT assigned FROM public.get_school_supervisor_assignments('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE supervisor_id = '00000000-0000-4000-8000-000000000102'::uuid),
  true,
  'admin can assign a supervisor to School A'
);
SELECT throws_ok(
  $$SELECT public.set_school_supervisor_assignment('00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-000000000101'::uuid, true)$$,
  '22023',
  'assignment management rejects users who are not supervisors'
);

SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)),
  9::bigint,
  'school settings return three school values and three values for each of two classes'
);
SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000202'::uuid)),
  6::bigint,
  'admin capability management remains globally scoped across schools'
);
SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid) WHERE enabled),
  9::bigint,
  'all capabilities are enabled when no configuration exists'
);
SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid) WHERE source = 'default'),
  9::bigint,
  'unconfigured school and class values report their default provenance'
);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid) WHERE enabled),
  3::bigint,
  'the effective class contract also defaults each capability to enabled'
);

SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'family_meal_records', false);
SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'monitor_internal_notifications', false);

SELECT is(
  (SELECT enabled FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id IS NULL AND capability = 'family_meal_records'),
  false,
  'a saved school capability is visible on a fresh settings read'
);
SELECT is(
  (SELECT enabled FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id IS NULL AND capability = 'monitor_internal_notifications'),
  false,
  'notification publishing is persisted independently'
);
SELECT is(
  (SELECT enabled FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id IS NULL AND capability = 'monitor_daily_summary'),
  true,
  'changing two capabilities leaves the daily summary enabled'
);
SELECT is(
  (SELECT enabled FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid AND capability = 'family_meal_records'),
  false,
  'a class with no override inherits the school value'
);
SELECT is(
  (SELECT source FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid AND capability = 'family_meal_records'),
  'school',
  'inherited values identify the school as their source'
);
SELECT is(
  (SELECT override_value FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid AND capability = 'family_meal_records'),
  NULL::boolean,
  'inheritance is represented as an absent override rather than false'
);

-- Parent reads resolve the selected child, despite having no users.school_id.
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000104', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)),
  3::bigint,
  'a parent can read effective settings for a related child'
);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)
    WHERE capability = 'family_meal_records'),
  false,
  'parent reads use the child class school fallback'
);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)
    WHERE capability = 'monitor_internal_notifications'),
  false,
  'parent contract returns all capabilities independently'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  2::bigint,
  'a parent can directly read persisted values for the linked child school'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'RLS hides another school capability row from the parent'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid),
  0::bigint,
  'RLS hides another school class override from the parent'
);
SELECT is(
  (SELECT count(*) FROM public.capability_catalog),
  3::bigint,
  'a parent can read catalog keys needed for an authorized effective-settings query'
);
SELECT is(
  (SELECT count(*) FROM public.school_supervisor_assignments),
  0::bigint,
  'RLS keeps supervisor assignment rows visible only to administrators'
);
SELECT throws_ok(
  $$INSERT INTO public.school_capabilities (school_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000201'::uuid, 'monitor_daily_summary', true)$$,
  '42501',
  'RLS rejects a parent direct write even within the linked school'
);
SELECT throws_ok(
  $$INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id)
    VALUES ('00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-000000000103'::uuid)$$,
  '42501',
  'RLS rejects a parent direct write to supervisor assignments'
);
SELECT is(
  (WITH changed AS (
    UPDATE public.school_capabilities SET enabled = true
     WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid
     RETURNING 1
  ) SELECT count(*) FROM changed),
  0::bigint,
  'RLS prevents a parent update to another school without exposing the row'
);
SELECT is(
  (WITH removed AS (
    DELETE FROM public.school_capabilities
     WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid
     RETURNING 1
  ) SELECT count(*) FROM removed),
  0::bigint,
  'RLS prevents a parent delete from another school without exposing the row'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000403'::uuid)$$,
  '42501',
  'a parent cannot read a child from another family or school'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)$$,
  '42501',
  'a parent cannot bypass child authorization by submitting a class id'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)$$,
  '42501',
  'a parent cannot read management settings'
);
SELECT throws_ok(
  $$SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'family_meal_records', true)$$,
  '42501',
  'a parent cannot write school capabilities'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000109', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)),
  3::bigint,
  'a related legacy padre can read effective capabilities for their child'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  3::bigint,
  'padre RLS reads only school configuration related to its linked child'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'padre RLS hides a different school configuration'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000403'::uuid)$$,
  '42501',
  'a legacy padre cannot read a child without a family relationship'
);

-- Monitor access follows the monitor's primary school and monitors_schools,
-- not worker_classrooms or users.school_id.
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000106', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT jsonb_object_agg(capability, enabled)
     FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)),
  '{"family_meal_records": false, "monitor_internal_notifications": false, "monitor_daily_summary": true}'::jsonb,
  'a monitor receives effective values for a class in its assigned school'
);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)),
  3::bigint,
  'a monitor can read another class within its assigned school'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  2::bigint,
  'monitor RLS exposes persisted values for its assigned school'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'monitor RLS hides another school capability row'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid),
  0::bigint,
  'monitor RLS hides another school class override'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000303'::uuid)$$,
  '42501',
  'a monitor cannot read a class in another school'
);
SELECT throws_ok(
  $$SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'family_meal_records', true)$$,
  '42501',
  'a monitor cannot write school capabilities'
);
SELECT throws_ok(
  $$SELECT public.set_class_capability('00000000-0000-4000-8000-000000000303'::uuid, 'family_meal_records', true)$$,
  '42501',
  'a monitor cannot write class overrides'
);
SELECT throws_ok(
  $$INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records', false)$$,
  '42501',
  'RLS rejects a monitor direct write even within its assigned school'
);

-- Workers use their assigned class relationship rather than monitor-school
-- membership or a broad school role.
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000110', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)),
  3::bigint,
  'a worker can read effective settings for its assigned class'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  2::bigint,
  'worker RLS allows school fallback values through its assigned class'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid),
  0::bigint,
  'worker RLS hides overrides outside its assigned class'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)$$,
  '42501',
  'a worker cannot read a sibling class without an assignment'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000303'::uuid)$$,
  '42501',
  'a worker cannot read a class from another school'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)$$,
  '42501',
  'a worker cannot read administrative settings'
);
SELECT throws_ok(
  $$INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records', false)$$,
  '42501',
  'RLS rejects a worker write even within its assigned class'
);

-- Admin writes explicit values in both directions; consumers see them on the next call.
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);
SELECT public.set_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records', true);
SELECT public.set_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'monitor_internal_notifications', true);
SELECT public.set_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'monitor_daily_summary', false);
SELECT is(
  (SELECT jsonb_object_agg(capability, enabled)
     FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)),
  '{"family_meal_records": true, "monitor_internal_notifications": true, "monitor_daily_summary": false}'::jsonb,
  'explicit class true and false overrides take precedence independently'
);
SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid AND source = 'class'),
  3::bigint,
  'all explicit class values report class provenance'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000104', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)
    WHERE capability = 'family_meal_records'),
  true,
  'a fresh parent query observes a newly saved class override'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid),
  3::bigint,
  'RLS exposes overrides for a class linked to the parent'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid),
  0::bigint,
  'RLS hides overrides for a class outside the parent relationship'
);
SELECT throws_ok(
  $$INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000302'::uuid, 'monitor_daily_summary', true)$$,
  '42501',
  'RLS rejects a family write even to a linked class override'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);
SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records');
SELECT is(
  (SELECT override_value FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id = '00000000-0000-4000-8000-000000000301'::uuid AND capability = 'family_meal_records'),
  NULL::boolean,
  'reset removes the class override'
);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)
    WHERE capability = 'family_meal_records'),
  false,
  'reset returns the class to the current school value'
);

SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'monitor_daily_summary', false);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  false,
  'an inherited class observes a later school change'
);
SET LOCAL ROLE postgres;
INSERT INTO public.classes (id, name, school_id) VALUES
  ('00000000-0000-4000-8000-000000000304'::uuid, 'Aula A3 nueva', '00000000-0000-4000-8000-000000000201'::uuid);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000304'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  false,
  'a newly created class inherits the current school value dynamically'
);
SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'monitor_daily_summary', true);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  true,
  'an existing inherited class follows the fresh school value'
);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000304'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  true,
  'a new inherited class also follows later school changes'
);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  false,
  'an explicit false override remains in force when the school is enabled'
);
SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'monitor_daily_summary');
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)
    WHERE capability = 'monitor_daily_summary'),
  true,
  'resetting an explicit false value inherits the currently enabled school value'
);
SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'monitor_internal_notifications');
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)
    WHERE capability = 'monitor_internal_notifications'),
  false,
  'resetting an explicit true value inherits the currently disabled school value'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated'
)::text, true);
SELECT throws_ok(
  $$SELECT * FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)$$,
  '42501',
  'an unassigned supervisor cannot read School A settings'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities),
  0::bigint,
  'RLS hides all school settings from an unassigned supervisor'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides),
  0::bigint,
  'RLS hides all class overrides from an unassigned supervisor'
);
SELECT throws_ok(
  $$INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records', true)$$,
  '42501',
  'RLS rejects an unassigned supervisor direct write'
);
SELECT throws_ok(
  $$SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'family_meal_records', false)$$,
  '42501',
  'an unassigned supervisor cannot write School A settings'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)$$,
  '42501',
  'an unassigned supervisor cannot read effective class settings'
);
SELECT throws_ok(
  $$SELECT public.set_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records', true)$$,
  '42501',
  'an unassigned supervisor cannot set a class override'
);
SELECT throws_ok(
  $$SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'family_meal_records')$$,
  '42501',
  'an unassigned supervisor cannot reset a class override'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_school_supervisor_assignments('00000000-0000-4000-8000-000000000201'::uuid)$$,
  '42501',
  'a supervisor cannot list school assignments'
);
SELECT throws_ok(
  $$SELECT public.set_school_supervisor_assignment('00000000-0000-4000-8000-000000000201'::uuid, '00000000-0000-4000-8000-000000000103'::uuid, true)$$,
  '42501',
  'a supervisor cannot assign themselves to a school'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000102', 'role', 'authenticated'
)::text, true);
SELECT is(
  (SELECT count(*) FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)),
  12::bigint,
  'an assigned supervisor can read School A settings and all its class settings'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_capability_settings('00000000-0000-4000-8000-000000000202'::uuid)$$,
  '42501',
  'an assigned supervisor cannot read School B settings'
);
SELECT is(
  (SELECT count(*) FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)),
  3::bigint,
  'an assigned supervisor can read effective settings for a class in School A'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  3::bigint,
  'RLS directly exposes assigned-school values to its supervisor'
);
SELECT is(
  (SELECT count(*) FROM public.school_capabilities
    WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'RLS directly hides another school value from the assigned supervisor'
);
SELECT is(
  (SELECT count(*) FROM public.class_capability_overrides
    WHERE class_id = '00000000-0000-4000-8000-000000000303'::uuid),
  0::bigint,
  'RLS directly hides class overrides outside the assigned school'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000303'::uuid)$$,
  '42501',
  'an assigned supervisor cannot read effective settings for a class in School B'
);
SELECT is(
  (SELECT count(*) FROM public.classes WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid),
  3::bigint,
  'an assigned supervisor can load School A classes for capability management'
);
SELECT is(
  (SELECT count(*) FROM public.classes WHERE school_id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'the class read policy hides School B classes from the School A supervisor'
);
SELECT is(
  (SELECT count(*) FROM public.schools WHERE id = '00000000-0000-4000-8000-000000000201'::uuid),
  1::bigint,
  'an assigned supervisor can select their assigned school record'
);
SELECT is(
  (SELECT count(*) FROM public.schools WHERE id = '00000000-0000-4000-8000-000000000202'::uuid),
  0::bigint,
  'an assigned supervisor cannot select an unassigned school record'
);
SELECT is(
  (WITH changed AS (
    UPDATE public.school_capabilities SET enabled = false
     WHERE school_id = '00000000-0000-4000-8000-000000000201'::uuid
       AND capability = 'monitor_daily_summary'
     RETURNING 1
  ) SELECT count(*) FROM changed),
  1::bigint,
  'an assigned supervisor can directly update its school value through RLS'
);
SELECT throws_ok(
  $$INSERT INTO public.school_capabilities (school_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000202'::uuid, 'monitor_daily_summary', true)$$,
  '42501',
  'RLS rejects a direct school write outside the supervisor assignment'
);
SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'monitor_daily_summary', false);
SELECT is(
  (SELECT enabled FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE class_id IS NULL AND capability = 'monitor_daily_summary'),
  false,
  'an assigned supervisor can persist a school-level setting in School A'
);
SELECT throws_ok(
  $$SELECT public.set_school_capability('00000000-0000-4000-8000-000000000202'::uuid, 'monitor_daily_summary', true)$$,
  '42501',
  'an assigned supervisor cannot change a school-level setting in School B'
);
INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
VALUES ('00000000-0000-4000-8000-000000000302'::uuid, 'family_meal_records', true);
SELECT throws_ok(
  $$INSERT INTO public.class_capability_overrides (class_id, capability, enabled)
    VALUES ('00000000-0000-4000-8000-000000000303'::uuid, 'monitor_daily_summary', true)$$,
  '42501',
  'RLS rejects a direct class write outside the supervisor assignment'
);
SELECT public.set_class_capability('00000000-0000-4000-8000-000000000302'::uuid, 'family_meal_records', true);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)
    WHERE capability = 'family_meal_records'),
  true,
  'an assigned supervisor can persist a class override in School A'
);
SELECT throws_ok(
  $$SELECT public.set_class_capability('00000000-0000-4000-8000-000000000303'::uuid, 'family_meal_records', true)$$,
  '42501',
  'an assigned supervisor cannot set a class override in School B'
);
SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000302'::uuid, 'family_meal_records');
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000302'::uuid)
    WHERE capability = 'family_meal_records'),
  false,
  'an assigned supervisor can reset a School A override to its school value'
);
SELECT throws_ok(
  $$SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000303'::uuid, 'family_meal_records')$$,
  '42501',
  'an assigned supervisor cannot reset a class override in School B'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);
SELECT public.set_school_supervisor_assignment(
  '00000000-0000-4000-8000-000000000201'::uuid,
  '00000000-0000-4000-8000-000000000102'::uuid,
  false
);
SELECT is(
  (SELECT assigned FROM public.get_school_supervisor_assignments('00000000-0000-4000-8000-000000000201'::uuid)
    WHERE supervisor_id = '00000000-0000-4000-8000-000000000102'::uuid),
  false,
  'admin can revoke a supervisor assignment'
);
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000102', 'role', 'authenticated'
)::text, true);
SELECT throws_ok(
  $$SELECT * FROM public.get_capability_settings('00000000-0000-4000-8000-000000000201'::uuid)$$,
  '42501',
  'revoking the assignment immediately removes School A capability access'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000108', 'role', 'authenticated'
)::text, true);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_child_id => '00000000-0000-4000-8000-000000000401'::uuid)$$,
  '42501',
  'inactive users cannot read capability values'
);

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'authenticated'
)::text, true);
SELECT throws_ok(
  $$SELECT public.set_school_capability('00000000-0000-4000-8000-000000000201'::uuid, 'unknown_capability', true)$$,
  '22023',
  'the write contract rejects capability keys outside the fixed set'
);
SELECT throws_ok(
  $$SELECT public.set_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'unknown_capability', true)$$,
  '22023',
  'setting a class rejects capability keys outside the fixed set'
);
SELECT throws_ok(
  $$SELECT public.reset_class_capability('00000000-0000-4000-8000-000000000301'::uuid, 'unknown_capability')$$,
  '22023',
  'resetting a class rejects capability keys outside the fixed set'
);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities()$$,
  '22023',
  'the effective read contract requires exactly one selected child or class'
);

-- Catalog extension is a migration/database-owner operation. Invoker reads
-- automatically include the new key and retain its enabled default.
SET LOCAL ROLE postgres;
INSERT INTO public.capability_catalog (capability, default_enabled)
VALUES ('migration_added_capability', true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000101', 'role', 'admin'
)::text, true);
SELECT is(
  (SELECT enabled FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)
    WHERE capability = 'migration_added_capability'),
  true,
  'the invoker effective-settings contract sees a migration-added key with its enabled default'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);
SELECT throws_ok(
  $$SELECT * FROM public.get_effective_capabilities(p_class_id => '00000000-0000-4000-8000-000000000301'::uuid)$$,
  '42501',
  'permission denied for function get_effective_capabilities',
  'anonymous callers cannot invoke the effective capability contract'
);

SELECT * FROM finish();

ROLLBACK;
