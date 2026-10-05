-- Contract tests for the weekly lunch pattern of a child in a school.
--
-- The pattern records the weekdays (Monday to Friday) a child usually eats at
-- school. Three states must stay distinguishable at the persistence boundary:
-- no row (unconfigured), a row with an empty selection (configured with no
-- days) and a row with one or more days. The pattern belongs to a (child,
-- school) pair: a class change keeps it, a school change leaves the origin
-- school's pattern in place and starts the new school unconfigured, and roles
-- only reach their own school.
--
-- Run through scripts/test-db.sh. All mutations are rolled back.

BEGIN;

SELECT plan(36);

SET LOCAL ROLE postgres;

INSERT INTO public.schools (id, name) VALUES
  ('00000000-0000-4000-8000-000000000211'::uuid, 'Lunch School A'),
  ('00000000-0000-4000-8000-000000000212'::uuid, 'Lunch School B');

INSERT INTO public.users (id, role, school_id, full_name, active) VALUES
  ('00000000-0000-4000-8000-000000000111'::uuid, 'admin', NULL, 'Lunch Admin', true),
  -- Legacy single-school scope: classroom policies still read users.school_id.
  ('00000000-0000-4000-8000-000000000112'::uuid, 'supervisor',
   '00000000-0000-4000-8000-000000000211'::uuid, 'Supervisor A', true),
  -- Assignment scope: no users.school_id, only an explicit school assignment.
  ('00000000-0000-4000-8000-000000000113'::uuid, 'supervisor', NULL, 'Supervisor B', true),
  ('00000000-0000-4000-8000-000000000114'::uuid, 'monitor', NULL, 'Monitor A', true),
  ('00000000-0000-4000-8000-000000000115'::uuid, 'monitor', NULL, 'Monitor B', true);

INSERT INTO public.classes (id, name, school_id) VALUES
  ('00000000-0000-4000-8000-000000000311'::uuid, 'Lunch Aula A1',
   '00000000-0000-4000-8000-000000000211'::uuid),
  ('00000000-0000-4000-8000-000000000312'::uuid, 'Lunch Aula A2',
   '00000000-0000-4000-8000-000000000211'::uuid),
  ('00000000-0000-4000-8000-000000000313'::uuid, 'Lunch Aula B1',
   '00000000-0000-4000-8000-000000000212'::uuid);

INSERT INTO public.children (id, class_id, name) VALUES
  ('00000000-0000-4000-8000-000000000411'::uuid,
   '00000000-0000-4000-8000-000000000311'::uuid, 'Lunch Child A1'),
  ('00000000-0000-4000-8000-000000000412'::uuid,
   '00000000-0000-4000-8000-000000000311'::uuid, 'Lunch Child A2'),
  ('00000000-0000-4000-8000-000000000413'::uuid,
   '00000000-0000-4000-8000-000000000311'::uuid, 'Lunch Child A3'),
  ('00000000-0000-4000-8000-000000000414'::uuid,
   '00000000-0000-4000-8000-000000000311'::uuid, 'Lunch Child A5'),
  ('00000000-0000-4000-8000-000000000415'::uuid,
   '00000000-0000-4000-8000-000000000313'::uuid, 'Lunch Child B1'),
  ('00000000-0000-4000-8000-000000000416'::uuid,
   '00000000-0000-4000-8000-000000000313'::uuid, 'Lunch Child B2');

INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id) VALUES
  ('00000000-0000-4000-8000-000000000212'::uuid,
   '00000000-0000-4000-8000-000000000113'::uuid);

INSERT INTO public.monitors (id, user_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000711'::uuid,
   '00000000-0000-4000-8000-000000000114'::uuid,
   '00000000-0000-4000-8000-000000000211'::uuid),
  ('00000000-0000-4000-8000-000000000712'::uuid,
   '00000000-0000-4000-8000-000000000115'::uuid,
   '00000000-0000-4000-8000-000000000212'::uuid);

INSERT INTO public.monitors_schools (monitor_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000711'::uuid,
   '00000000-0000-4000-8000-000000000211'::uuid),
  ('00000000-0000-4000-8000-000000000712'::uuid,
   '00000000-0000-4000-8000-000000000212'::uuid);

-- ── Persistence surface ──────────────────────────────────────────────────────

SELECT has_table('public', 'child_lunch_days',
  'the weekly lunch pattern persists per child and school');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.child_lunch_days'::regclass),
  'row level security is enabled on the lunch pattern'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.child_lunch_days', 'SELECT')
  AND has_table_privilege('authenticated', 'public.child_lunch_days', 'INSERT')
  AND has_table_privilege('authenticated', 'public.child_lunch_days', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.child_lunch_days', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.child_lunch_days', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.child_lunch_days', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.child_lunch_days', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.child_lunch_days', 'DELETE'),
  'authenticated callers hold the RLS-gated read/write grants while anon cannot touch the table'
);

SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'child_lunch_days'
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4,
  'the pattern is governed by one scoped policy per row action'
);

-- ── The three states ─────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days),
  0::bigint,
  'existing children start unconfigured: no pattern is inferred or backfilled'
);

INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
VALUES ('00000000-0000-4000-8000-000000000411'::uuid,
        '00000000-0000-4000-8000-000000000211'::uuid, '{1,3,5}');

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000211'::uuid),
  '{1,3,5}'::smallint[],
  'a configured pattern persists the selected weekdays'
);

INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
VALUES ('00000000-0000-4000-8000-000000000412'::uuid,
        '00000000-0000-4000-8000-000000000211'::uuid, '{}');

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000412'::uuid),
  1::bigint,
  'a pattern configured with no days still persists as a row'
);

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000412'::uuid),
  '{}'::smallint[],
  'the configured-with-no-days selection is stored as an empty selection'
);

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000413'::uuid),
  0::bigint,
  'an unconfigured child has no row, so it stays distinguishable from an empty pattern'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000413'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{6}')$$,
  '23514'::char(5), NULL,
  'weekends are outside the Monday-to-Friday selection'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000413'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{0}')$$,
  '23514'::char(5), NULL,
  'only the Monday-to-Friday weekday codes are accepted'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000413'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, NULL)$$,
  NULL,
  'a configured pattern always stores a selection, empty or not'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000411'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{2}')$$,
  '23505'::char(5), NULL,
  'a child holds a single pattern per school'
);

-- ── Class and school changes ─────────────────────────────────────────────────

UPDATE public.children
   SET class_id = '00000000-0000-4000-8000-000000000312'::uuid
 WHERE id = '00000000-0000-4000-8000-000000000411'::uuid;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.child_lunch_days
     WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
       AND school_id = '00000000-0000-4000-8000-000000000211'::uuid
       AND weekdays = '{1,3,5}'
  ),
  'changing class inside the same school keeps the pattern'
);

UPDATE public.children
   SET class_id = '00000000-0000-4000-8000-000000000313'::uuid
 WHERE id = '00000000-0000-4000-8000-000000000411'::uuid;

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.child_lunch_days
     WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
       AND school_id = '00000000-0000-4000-8000-000000000211'::uuid
       AND weekdays = '{1,3,5}'
  ),
  'the origin school keeps the pattern when the child changes school'
);

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000212'::uuid),
  0::bigint,
  'the new school starts unconfigured: the pattern is not copied across schools'
);

INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
VALUES ('00000000-0000-4000-8000-000000000411'::uuid,
        '00000000-0000-4000-8000-000000000212'::uuid, '{4}');

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid),
  2::bigint,
  'a child holds one pattern per school'
);

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000211'::uuid),
  '{1,3,5}'::smallint[],
  'configuring the new school leaves the origin pattern untouched'
);

-- ── Administrator scope ──────────────────────────────────────────────────────

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000111',
    'role', 'admin'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000413'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{1,2}')$$,
  'an admin configures a pattern in one school'
);

SELECT lives_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000416'::uuid,
            '00000000-0000-4000-8000-000000000212'::uuid, '{5}')$$,
  'an admin configures a pattern in another school'
);

SELECT is(
  (SELECT count(DISTINCT school_id) FROM public.child_lunch_days),
  2::bigint,
  'an admin reads the patterns of every school'
);

-- ── Supervisor scope: the school they manage ─────────────────────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000112',
    'role', 'supervisor'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000414'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{1,3}')$$,
  'a supervisor configures a pattern in their own school'
);

UPDATE public.child_lunch_days
   SET weekdays = '{2,4}'
 WHERE child_id = '00000000-0000-4000-8000-000000000413'::uuid
   AND school_id = '00000000-0000-4000-8000-000000000211'::uuid;

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000413'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000211'::uuid),
  '{2,4}'::smallint[],
  'a supervisor rewrites the pattern of their own school'
);

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE school_id = '00000000-0000-4000-8000-000000000212'::uuid),
  0::bigint,
  'a supervisor cannot see the patterns of another school'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000414'::uuid,
            '00000000-0000-4000-8000-000000000212'::uuid, '{1}')$$,
  '42501'::char(5), NULL,
  'a supervisor cannot configure a pattern in another school'
);

DELETE FROM public.child_lunch_days
 WHERE child_id = '00000000-0000-4000-8000-000000000414'::uuid
   AND school_id = '00000000-0000-4000-8000-000000000211'::uuid;

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000414'::uuid),
  0::bigint,
  'a supervisor can return their pattern to unconfigured'
);

UPDATE public.child_lunch_days
   SET weekdays = '{5}'
 WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
   AND school_id = '00000000-0000-4000-8000-000000000212'::uuid;

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000212'::uuid),
  '{4}'::smallint[],
  'a supervisor cannot rewrite the pattern of another school'
);

SET LOCAL ROLE authenticated;

-- ── Supervisor scope: an explicit school assignment ──────────────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000113',
    'role', 'supervisor'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000415'::uuid,
            '00000000-0000-4000-8000-000000000212'::uuid, '{2,3}')$$,
  'a supervisor configured through a school assignment configures that school'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000414'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{1}')$$,
  '42501'::char(5), NULL,
  'an assigned supervisor cannot configure another school'
);

-- ── Monitor scope: read-only in their own schools ────────────────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000114',
    'role', 'monitor'
  )::text,
  true
);

SELECT ok(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE school_id = '00000000-0000-4000-8000-000000000211'::uuid) > 0,
  'a monitor reads the patterns of their own school'
);

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE school_id = '00000000-0000-4000-8000-000000000212'::uuid),
  0::bigint,
  'a monitor cannot read the patterns of another school'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000414'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{1}')$$,
  '42501'::char(5), NULL,
  'a monitor cannot configure a pattern'
);

UPDATE public.child_lunch_days
   SET weekdays = '{5}'
 WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
   AND school_id = '00000000-0000-4000-8000-000000000211'::uuid;

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000211'::uuid),
  '{1,3,5}'::smallint[],
  'a monitor cannot rewrite a pattern: the stored selection is untouched'
);

DELETE FROM public.child_lunch_days
 WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
   AND school_id = '00000000-0000-4000-8000-000000000211'::uuid;

SELECT is(
  (SELECT count(*) FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000411'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000211'::uuid),
  1::bigint,
  'a monitor cannot remove a pattern: the row is still there'
);

-- ── Anonymous callers ────────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT count(*) FROM public.child_lunch_days$$,
  '42501'::char(5), NULL,
  'an anonymous caller cannot read patterns'
);

SELECT throws_ok(
  $$INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
    VALUES ('00000000-0000-4000-8000-000000000414'::uuid,
            '00000000-0000-4000-8000-000000000211'::uuid, '{1}')$$,
  '42501'::char(5), NULL,
  'an anonymous caller cannot configure a pattern'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
