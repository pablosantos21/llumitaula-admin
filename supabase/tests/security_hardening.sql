-- Contract tests for Issue #31 security hardening, strict active-role/tenant
-- RLS isolation, monitor credential/deletion revocation, expiring cryptographic
-- device config codes, device delete RLS, and atomic child allergen replacement.
--
-- Run through scripts/test-db.sh. All mutations are rolled back.

BEGIN;

SELECT plan(63);

SET LOCAL ROLE postgres;

-- ── Deterministic fixtures ──────────────────────────────────────────────────

INSERT INTO public.schools (id, name) VALUES
  ('00000000-0000-4000-8000-000000000801'::uuid, 'Sec School A'),
  ('00000000-0000-4000-8000-000000000802'::uuid, 'Sec School B');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  ('00000000-0000-4000-8000-000000000901'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.admin@test.local',
   extensions.crypt('AdminSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sec Admin"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000902'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.inactive.admin@test.local',
   extensions.crypt('AdminSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Inactive Admin"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000903'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.sup.a@test.local',
   extensions.crypt('SupSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Supervisor A"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000904'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.mon.a@test.local',
   extensions.crypt('MonSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Monitor A"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000905'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.mon.b@test.local',
   extensions.crypt('MonSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Monitor B"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000906'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.parent.a@test.local',
   extensions.crypt('ParentSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Parent A"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000907'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.worker.a@test.local',
   extensions.crypt('WorkerSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Worker A"}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000908'::uuid, '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'sec.new.user@test.local',
   extensions.crypt('NewSecret!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"New User"}'::jsonb, now(), now());

INSERT INTO public.users (id, role, school_id, full_name, active) VALUES
  ('00000000-0000-4000-8000-000000000901'::uuid, 'admin',      NULL,                                         'Sec Admin',      true),
  ('00000000-0000-4000-8000-000000000902'::uuid, 'admin',      NULL,                                         'Inactive Admin', false),
  ('00000000-0000-4000-8000-000000000903'::uuid, 'supervisor', '00000000-0000-4000-8000-000000000801'::uuid, 'Supervisor A',   true),
  ('00000000-0000-4000-8000-000000000904'::uuid, 'monitor',    '00000000-0000-4000-8000-000000000801'::uuid, 'Monitor A',      true),
  ('00000000-0000-4000-8000-000000000905'::uuid, 'monitor',    '00000000-0000-4000-8000-000000000802'::uuid, 'Monitor B',      true),
  ('00000000-0000-4000-8000-000000000906'::uuid, 'parent',     NULL,                                         'Parent A',       true),
  ('00000000-0000-4000-8000-000000000907'::uuid, 'worker',     NULL,                                         'Worker A',       true);

INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id) VALUES
  ('00000000-0000-4000-8000-000000000801'::uuid, '00000000-0000-4000-8000-000000000903'::uuid);

INSERT INTO public.classes (id, name, school_id) VALUES
  ('00000000-0000-4000-8000-000000000811'::uuid, 'Aula Sec A1', '00000000-0000-4000-8000-000000000801'::uuid),
  ('00000000-0000-4000-8000-000000000812'::uuid, 'Aula Sec B1', '00000000-0000-4000-8000-000000000802'::uuid);

INSERT INTO public.children (id, class_id, name) VALUES
  ('00000000-0000-4000-8000-000000000821'::uuid, '00000000-0000-4000-8000-000000000811'::uuid, 'Child Sec A1'),
  ('00000000-0000-4000-8000-000000000822'::uuid, '00000000-0000-4000-8000-000000000812'::uuid, 'Child Sec B1');

INSERT INTO public.parents_children (parent_id, child_id) VALUES
  ('00000000-0000-4000-8000-000000000906'::uuid, '00000000-0000-4000-8000-000000000821'::uuid);

INSERT INTO public.worker_classrooms (worker_id, class_id) VALUES
  ('00000000-0000-4000-8000-000000000907'::uuid, '00000000-0000-4000-8000-000000000811'::uuid);

INSERT INTO public.monitors (id, user_id, school_id, first_name, last_name, code) VALUES
  ('00000000-0000-4000-8000-000000000831'::uuid, '00000000-0000-4000-8000-000000000904'::uuid,
   '00000000-0000-4000-8000-000000000801'::uuid, 'Ana', 'MonitorA', 1234),
  ('00000000-0000-4000-8000-000000000832'::uuid, '00000000-0000-4000-8000-000000000905'::uuid,
   '00000000-0000-4000-8000-000000000802'::uuid, 'Luis', 'MonitorB', 5678);

INSERT INTO public.monitors_schools (monitor_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000831'::uuid, '00000000-0000-4000-8000-000000000801'::uuid),
  ('00000000-0000-4000-8000-000000000832'::uuid, '00000000-0000-4000-8000-000000000802'::uuid);

INSERT INTO public.allergens (id, name) VALUES
  ('00000000-0000-4000-8000-000000000841'::uuid, 'Gluten'),
  ('00000000-0000-4000-8000-000000000842'::uuid, 'Frutos secos');

INSERT INTO public.child_allergens (child_id, allergen_id) VALUES
  ('00000000-0000-4000-8000-000000000821'::uuid, '00000000-0000-4000-8000-000000000841'::uuid),
  ('00000000-0000-4000-8000-000000000822'::uuid, '00000000-0000-4000-8000-000000000842'::uuid);

INSERT INTO public.incidents (id, child_id, description) VALUES
  ('00000000-0000-4000-8000-000000000851'::uuid, '00000000-0000-4000-8000-000000000821'::uuid, 'Incident A'),
  ('00000000-0000-4000-8000-000000000852'::uuid, '00000000-0000-4000-8000-000000000822'::uuid, 'Incident B');

INSERT INTO public.menus (id, first_course, second_course, type) VALUES
  ('00000000-0000-4000-8000-000000000861'::uuid, 'Sopa A', 'Pollo A', 'normal'),
  ('00000000-0000-4000-8000-000000000862'::uuid, 'Sopa B', 'Pollo B', 'normal');

INSERT INTO public.menus_schools (menu_id, school_id, date) VALUES
  ('00000000-0000-4000-8000-000000000861'::uuid, '00000000-0000-4000-8000-000000000801'::uuid, date '2026-11-25'),
  ('00000000-0000-4000-8000-000000000862'::uuid, '00000000-0000-4000-8000-000000000802'::uuid, date '2026-11-25');

INSERT INTO public.devices (id, school_id, name, active) VALUES
  ('00000000-0000-4000-8000-000000000871'::uuid, '00000000-0000-4000-8000-000000000801'::uuid, 'Tablet Sec A', true),
  ('00000000-0000-4000-8000-000000000872'::uuid, '00000000-0000-4000-8000-000000000802'::uuid, 'Tablet Sec B', true);

-- ── 1. custom_access_token_hook & meal_history security_invoker ─────────────

SELECT is(
  public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-4000-8000-000000000901', 'claims', '{}'::jsonb)
  ) -> 'claims' ->> 'role',
  'admin',
  'custom_access_token_hook emits role claim for active admin'
);

SELECT is(
  public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-4000-8000-000000000902', 'claims', '{}'::jsonb)
  ) -> 'claims' ->> 'role',
  NULL,
  'custom_access_token_hook omits privileged role claim for inactive admin'
);

SELECT is(
  public.custom_access_token_hook(
    jsonb_build_object('user_id', '00000000-0000-4000-8000-000000000902', 'claims', '{}'::jsonb)
  ) -> 'claims' ->> 'active',
  'false',
  'custom_access_token_hook marks inactive user active=false'
);

SELECT ok(
  EXISTS (
    SELECT 1
      FROM pg_class c
     WHERE c.oid = 'public.meal_history'::regclass
       AND c.reloptions @> ARRAY['security_invoker=true']
  ),
  'public.meal_history enforces security_invoker=true'
);

SELECT ok(
  pg_get_functiondef('public.generate_device_config_code(uuid)'::regprocedure) LIKE '%gen_random_bytes%'
  AND pg_get_functiondef('public.generate_device_config_code(uuid)'::regprocedure) NOT LIKE '%random()%',
  'generate_device_config_code uses gen_random_bytes() instead of random()'
);

SELECT ok(
  NOT (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = 'public.set_child_allergens(uuid,uuid[])'::regprocedure)
  AND has_function_privilege('authenticated', 'public.set_child_allergens(uuid,uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.set_child_allergens(uuid,uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('service_role', 'public.set_child_allergens(uuid,uuid[])', 'EXECUTE'),
  'set_child_allergens is SECURITY INVOKER and executable by authenticated only'
);

-- ── 2. Users privilege-escalation prevention (INSERT & UPDATE) ──────────────

SET LOCAL ROLE authenticated;

-- Monitor attempting to escalate own role to admin
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000904', 'role', 'monitor'
)::text, true);

SELECT throws_ok(
  $$UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000904'::uuid$$,
  '42501',
  NULL,
  'monitor cannot escalate own role to admin'
);

SELECT throws_ok(
  $$UPDATE public.users SET school_id = '00000000-0000-4000-8000-000000000802'::uuid WHERE id = '00000000-0000-4000-8000-000000000904'::uuid$$,
  '42501',
  NULL,
  'monitor cannot change own school_id'
);

SELECT throws_ok(
  $$UPDATE public.users SET active = false WHERE id = '00000000-0000-4000-8000-000000000904'::uuid$$,
  '42501',
  NULL,
  'monitor cannot modify own active flag'
);

-- Parent attempting to escalate own role to admin
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000906', 'role', 'parent'
)::text, true);

SELECT throws_ok(
  $$UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000906'::uuid$$,
  '42501',
  NULL,
  'parent cannot escalate own role to admin'
);

-- Worker attempting to escalate own role to admin
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000907', 'role', 'worker'
)::text, true);

SELECT throws_ok(
  $$UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000907'::uuid$$,
  '42501',
  NULL,
  'worker cannot escalate own role to admin'
);

-- Supervisor attempting to escalate role or change school_id or active
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000903', 'role', 'supervisor'
)::text, true);

SELECT throws_ok(
  $$UPDATE public.users SET role = 'admin' WHERE id = '00000000-0000-4000-8000-000000000903'::uuid$$,
  '42501',
  NULL,
  'supervisor cannot escalate own role to admin'
);

SELECT throws_ok(
  $$UPDATE public.users SET school_id = '00000000-0000-4000-8000-000000000802'::uuid WHERE id = '00000000-0000-4000-8000-000000000903'::uuid$$,
  '42501',
  NULL,
  'supervisor cannot switch own school_id to another school'
);

SELECT throws_ok(
  $$UPDATE public.users SET active = false WHERE id = '00000000-0000-4000-8000-000000000904'::uuid$$,
  '42501',
  NULL,
  'supervisor cannot modify active flag on users'
);

-- New authenticated user attempting INSERT with privileged role / school_id / active=false
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000908', 'role', 'authenticated'
)::text, true);

SELECT throws_ok(
  $$INSERT INTO public.users (id, role, school_id, full_name, active)
    VALUES ('00000000-0000-4000-8000-000000000908'::uuid, 'admin', NULL, 'Sneaky', true)$$,
  '42501',
  NULL,
  'non-admin cannot INSERT own profile with role=admin'
);

SELECT throws_ok(
  $$INSERT INTO public.users (id, role, school_id, full_name, active)
    VALUES ('00000000-0000-4000-8000-000000000908'::uuid, 'parent', '00000000-0000-4000-8000-000000000801'::uuid, 'Sneaky', true)$$,
  '42501',
  NULL,
  'non-admin cannot INSERT own profile with a school_id'
);

SELECT throws_ok(
  $$INSERT INTO public.users (id, role, school_id, full_name, active)
    VALUES ('00000000-0000-4000-8000-000000000908'::uuid, 'parent', NULL, 'Sneaky', false)$$,
  '42501',
  NULL,
  'non-admin cannot INSERT own profile with active=false'
);

SELECT lives_ok(
  $$INSERT INTO public.users (id, role, school_id, full_name, active)
    VALUES ('00000000-0000-4000-8000-000000000908'::uuid, 'parent', NULL, 'Legit Parent', true)$$,
  'new user can self-insert a default active parent profile with null school_id'
);

-- Inactive admin with stale admin JWT claim is locked out
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000902', 'role', 'admin'
)::text, true);

SELECT is((SELECT count(*) FROM public.schools), 0::bigint, 'inactive admin cannot read schools even with stale admin JWT');
SELECT is((SELECT count(*) FROM public.children), 0::bigint, 'inactive admin cannot read children even with stale admin JWT');
SELECT is((SELECT count(*) FROM public.child_allergens), 0::bigint, 'inactive admin cannot read child_allergens');
SELECT throws_ok(
  $$SELECT public.generate_device_config_code('00000000-0000-4000-8000-000000000871'::uuid)$$,
  NULL,
  'inactive admin cannot mint device config code'
);

-- ── 3. Strict tenant & role isolation across tables ─────────────────────────

-- Parent A (only Child A1 in School A)
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000906', 'role', 'parent'
)::text, true);

SELECT is((SELECT count(*) FROM public.schools), 1::bigint, 'parent only sees their child school');
SELECT is((SELECT count(*) FROM public.classes), 1::bigint, 'parent only sees their child class');
SELECT is((SELECT count(*) FROM public.children), 1::bigint, 'parent only sees their own child');
SELECT is((SELECT count(*) FROM public.child_allergens), 1::bigint, 'parent only sees their own child allergens');
SELECT is((SELECT count(*) FROM public.incidents), 1::bigint, 'parent only sees their own child incidents');
SELECT is((SELECT count(*) FROM public.menus), 1::bigint, 'parent only sees their child school menus');
SELECT is((SELECT count(*) FROM public.menus_schools), 1::bigint, 'parent only sees their child school menu links');
SELECT is((SELECT count(*) FROM public.monitors), 0::bigint, 'parent cannot read monitors');

SELECT throws_ok(
  $$SELECT code FROM public.monitors$$,
  '42501',
  NULL,
  'authenticated parent cannot select monitors.code column'
);

SELECT throws_ok(
  $$INSERT INTO public.child_allergens (child_id, allergen_id)
    VALUES ('00000000-0000-4000-8000-000000000822'::uuid, '00000000-0000-4000-8000-000000000841'::uuid)$$,
  '42501',
  NULL,
  'parent cannot write child_allergens'
);

SELECT throws_ok(
  $$INSERT INTO public.incidents (child_id, description)
    VALUES ('00000000-0000-4000-8000-000000000821'::uuid, 'Fake incident')$$,
  '42501',
  NULL,
  'parent cannot insert incidents'
);

-- Monitor A (School A only)
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000904', 'role', 'monitor'
)::text, true);

SELECT is((SELECT count(*) FROM public.schools), 1::bigint, 'monitor only sees their assigned school');
SELECT is((SELECT count(*) FROM public.classes), 1::bigint, 'monitor only sees classes in their school');
SELECT is((SELECT count(*) FROM public.children), 1::bigint, 'monitor only sees children in their school');
SELECT is((SELECT count(*) FROM public.child_allergens), 1::bigint, 'monitor only sees allergens for children in their school');
SELECT is((SELECT count(*) FROM public.incidents), 1::bigint, 'monitor only sees incidents for children in their school');
SELECT is((SELECT count(*) FROM public.menus), 1::bigint, 'monitor only sees menus of their school');
SELECT is((SELECT count(*) FROM public.menus_schools), 1::bigint, 'monitor only sees menu links of their school');
SELECT is((SELECT count(*) FROM public.monitors), 1::bigint, 'monitor only sees their own monitor record');

SELECT throws_ok(
  $$INSERT INTO public.incidents (child_id, description)
    VALUES ('00000000-0000-4000-8000-000000000822'::uuid, 'Cross-school incident')$$,
  '42501',
  NULL,
  'monitor A cannot insert incident for child in school B'
);

SELECT lives_ok(
  $$INSERT INTO public.incidents (child_id, description)
    VALUES ('00000000-0000-4000-8000-000000000821'::uuid, 'Valid school A incident')$$,
  'monitor A can insert incident for child in school A'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
      (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES (
      '00000000-0000-4000-8000-000000000822'::uuid,
      '00000000-0000-4000-8000-000000000811'::uuid,
      '00000000-0000-4000-8000-000000000801'::uuid,
      date '2026-11-25', true,
      '00000000-0000-4000-8000-000000000904'::uuid, now()
    )$$,
  '42501',
  NULL,
  'monitor A cannot spoof daily_attendance for school B child under school A'
);

SELECT throws_ok(
  $$SELECT public.set_child_allergens('00000000-0000-4000-8000-000000000821'::uuid, '{}'::uuid[])$$,
  '42501',
  NULL,
  'monitor cannot modify child_allergens via set_child_allergens'
);

-- Supervisor A (School A only)
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000903', 'role', 'supervisor'
)::text, true);

SELECT is((SELECT count(*) FROM public.monitors), 1::bigint, 'supervisor A only sees monitors of school A');
SELECT is((SELECT count(*) FROM public.incidents), 2::bigint, 'supervisor A sees only school A incidents');

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000822'::uuid, '00000000-0000-4000-8000-000000000801'::uuid, '{1,2}')$$,
  '42501',
  NULL,
  'supervisor A cannot insert child_lunch_days for school B child under school A'
);

SELECT throws_ok(
  $$SELECT public.set_child_allergens('00000000-0000-4000-8000-000000000822'::uuid, '{}'::uuid[])$$,
  '42501',
  NULL,
  'supervisor A cannot modify allergens of school B child'
);

-- Device delete RLS for supervisor A
WITH removed_b AS (
  DELETE FROM public.devices
   WHERE id = '00000000-0000-4000-8000-000000000872'::uuid
   RETURNING id
)
SELECT is((SELECT count(*) FROM removed_b), 0::bigint, 'supervisor A cannot delete device in school B');

WITH removed_a AS (
  DELETE FROM public.devices
   WHERE id = '00000000-0000-4000-8000-000000000871'::uuid
   RETURNING id
)
SELECT is((SELECT count(*) FROM removed_a), 1::bigint, 'supervisor A can actually delete device in school A');

-- ── 4. Active Admin: device code expiry, atomic allergens, monitor lifecycle ─

SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000901', 'role', 'admin'
)::text, true);

SELECT throws_ok(
  $$SELECT code FROM public.monitors$$,
  '42501',
  NULL,
  'monitors.code column is not directly readable via SQL even for admin'
);

-- Device code generation with expiration
CREATE TEMP TABLE tmp_sec_code (code text);
INSERT INTO tmp_sec_code (code)
SELECT public.generate_device_config_code('00000000-0000-4000-8000-000000000872'::uuid);

SELECT ok(
  (SELECT code FROM tmp_sec_code) ~ '^[0-9A-Z]{6}$',
  'generated device config code is 6 uniform alphanumeric characters'
);

SELECT ok(
  (SELECT config_code_expires_at > config_code_created_at
     FROM public.devices
    WHERE id = '00000000-0000-4000-8000-000000000872'::uuid),
  'generate_device_config_code sets a future config_code_expires_at'
);

-- Atomic set_child_allergens: failure preserves previous allergens
SELECT lives_ok(
  $$SELECT public.set_child_allergens(
      '00000000-0000-4000-8000-000000000821'::uuid,
      ARRAY['00000000-0000-4000-8000-000000000841'::uuid,
            '00000000-0000-4000-8000-000000000842'::uuid,
            '00000000-0000-4000-8000-000000000841'::uuid]
    )$$,
  'admin can atomically replace child allergens with deduplication'
);

SELECT is(
  (SELECT count(*) FROM public.child_allergens WHERE child_id = '00000000-0000-4000-8000-000000000821'::uuid),
  2::bigint,
  'deduplicated allergens were persisted'
);

SELECT throws_ok(
  $$SELECT public.set_child_allergens(
      '00000000-0000-4000-8000-000000000821'::uuid,
      ARRAY['00000000-0000-4000-8000-000000000999'::uuid]
    )$$,
  '23503',
  NULL,
  'set_child_allergens rejects invalid allergen id'
);

SELECT is(
  (SELECT count(*) FROM public.child_allergens WHERE child_id = '00000000-0000-4000-8000-000000000821'::uuid),
  2::bigint,
  'atomicity: failed set_child_allergens preserves existing medical allergens'
);

-- create_monitor does NOT store PIN as auth.users password; delete_monitor revokes access
CREATE TEMP TABLE tmp_created_monitor (payload jsonb);
INSERT INTO tmp_created_monitor (payload)
SELECT public.create_monitor('Carlos', 'Prueba', 4321::smallint, '00000000-0000-4000-8000-000000000801'::uuid);

SET LOCAL ROLE postgres;
SELECT is(
  (SELECT u.encrypted_password = extensions.crypt('4321', u.encrypted_password)
     FROM auth.users u
    WHERE u.id = ((SELECT payload ->> 'user_id' FROM tmp_created_monitor)::uuid)),
  false,
  'create_monitor does not use plaintext PIN as auth.users password'
);

INSERT INTO auth.sessions (id, user_id, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000899'::uuid,
  ((SELECT payload ->> 'user_id' FROM tmp_created_monitor)::uuid),
  now(), now()
);

-- Non-admin cannot delete_monitor
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000903', 'role', 'supervisor'
)::text, true);

SELECT throws_ok(
  format(
    $$SELECT public.delete_monitor(%L::uuid)$$,
    (SELECT payload ->> 'monitor_id' FROM tmp_created_monitor)
  ),
  '42501',
  NULL,
  'non-admin cannot invoke delete_monitor'
);

-- Admin deletes monitor and revokes public.users + auth.users + sessions
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', '00000000-0000-4000-8000-000000000901', 'role', 'admin'
)::text, true);

SELECT lives_ok(
  format(
    $$SELECT public.delete_monitor(%L::uuid)$$,
    (SELECT payload ->> 'monitor_id' FROM tmp_created_monitor)
  ),
  'admin can delete_monitor via RPC'
);

SET LOCAL ROLE postgres;
SELECT is(
  (SELECT active FROM public.users
    WHERE id = ((SELECT payload ->> 'user_id' FROM tmp_created_monitor)::uuid)),
  false,
  'delete_monitor deactivates public.users record'
);

SELECT ok(
  (SELECT banned_until > now() FROM auth.users
    WHERE id = ((SELECT payload ->> 'user_id' FROM tmp_created_monitor)::uuid))
  AND NOT EXISTS (
    SELECT 1 FROM auth.sessions
     WHERE user_id = ((SELECT payload ->> 'user_id' FROM tmp_created_monitor)::uuid)
  ),
  'delete_monitor bans auth.users account and clears active sessions'
);

SELECT * FROM finish();

ROLLBACK;
