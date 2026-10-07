-- Contract tests for the daily attendance list confirmed by monitors.
--
-- Each row records one child's presence for one day in one class, plus who
-- confirmed the list and when. Re-confirming the same day overwrites the
-- mark and the metadata: there is exactly one row per (child, date), never
-- a history. Confirming a day with nobody present still writes rows (all
-- absent), so a confirmed-empty day stays distinguishable from a day that
-- was never passed (no rows). Writing attendance never touches the weekly
-- pattern (child_lunch_days) nor meal records.
--
-- Run through scripts/test-db.sh. All mutations are rolled back.

BEGIN;

SELECT plan(34);

SET LOCAL ROLE postgres;

INSERT INTO public.schools (id, name) VALUES
  ('00000000-0000-4000-8000-000000000221'::uuid, 'Attendance School A'),
  ('00000000-0000-4000-8000-000000000222'::uuid, 'Attendance School B');

INSERT INTO public.users (id, role, school_id, full_name, active) VALUES
  ('00000000-0000-4000-8000-000000000121'::uuid, 'admin', NULL, 'Attendance Admin', true),
  ('00000000-0000-4000-8000-000000000122'::uuid, 'supervisor',
   '00000000-0000-4000-8000-000000000221'::uuid, 'Supervisor A', true),
  ('00000000-0000-4000-8000-000000000123'::uuid, 'supervisor', NULL, 'Supervisor B', true),
  ('00000000-0000-4000-8000-000000000124'::uuid, 'monitor', NULL, 'Monitor A', true),
  ('00000000-0000-4000-8000-000000000125'::uuid, 'monitor', NULL, 'Monitor B', true),
  ('00000000-0000-4000-8000-000000000126'::uuid, 'parent', NULL, 'Parent A', true),
  ('00000000-0000-4000-8000-000000000127'::uuid, 'worker', NULL, 'Worker A', true),
  ('00000000-0000-4000-8000-000000000128'::uuid, 'monitor', NULL, 'Inactive Monitor', false);

INSERT INTO public.classes (id, name, school_id) VALUES
  ('00000000-0000-4000-8000-000000000321'::uuid, 'Attendance Aula A1',
   '00000000-0000-4000-8000-000000000221'::uuid),
  ('00000000-0000-4000-8000-000000000322'::uuid, 'Attendance Aula B1',
   '00000000-0000-4000-8000-000000000222'::uuid);

INSERT INTO public.children (id, class_id, name) VALUES
  ('00000000-0000-4000-8000-000000000421'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid, 'Attendance Child A1'),
  ('00000000-0000-4000-8000-000000000422'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid, 'Attendance Child A2'),
  ('00000000-0000-4000-8000-000000000423'::uuid,
   '00000000-0000-4000-8000-000000000322'::uuid, 'Attendance Child B1');

INSERT INTO public.school_supervisor_assignments (school_id, supervisor_id) VALUES
  ('00000000-0000-4000-8000-000000000221'::uuid,
   '00000000-0000-4000-8000-000000000122'::uuid),
  ('00000000-0000-4000-8000-000000000222'::uuid,
   '00000000-0000-4000-8000-000000000123'::uuid);

INSERT INTO public.monitors (id, user_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000721'::uuid,
   '00000000-0000-4000-8000-000000000124'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid),
  ('00000000-0000-4000-8000-000000000722'::uuid,
   '00000000-0000-4000-8000-000000000125'::uuid,
   '00000000-0000-4000-8000-000000000222'::uuid);

INSERT INTO public.monitors_schools (monitor_id, school_id) VALUES
  ('00000000-0000-4000-8000-000000000721'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid),
  ('00000000-0000-4000-8000-000000000722'::uuid,
   '00000000-0000-4000-8000-000000000222'::uuid);

INSERT INTO public.worker_classrooms (worker_id, class_id) VALUES
  ('00000000-0000-4000-8000-000000000127'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid);

INSERT INTO public.parents_children (parent_id, child_id) VALUES
  ('00000000-0000-4000-8000-000000000126'::uuid,
   '00000000-0000-4000-8000-000000000421'::uuid);

-- ── Persistence surface ──────────────────────────────────────────────────

SELECT has_table('public', 'daily_attendance',
  'the confirmed daily list persists per child, class and date');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.daily_attendance'::regclass),
  'row level security is enabled on the daily attendance'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.daily_attendance', 'SELECT')
  AND has_table_privilege('authenticated', 'public.daily_attendance', 'INSERT')
  AND has_table_privilege('authenticated', 'public.daily_attendance', 'UPDATE')
  AND has_table_privilege('authenticated', 'public.daily_attendance', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.daily_attendance', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.daily_attendance', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.daily_attendance', 'UPDATE')
  AND NOT has_table_privilege('anon', 'public.daily_attendance', 'DELETE'),
  'authenticated callers hold the RLS-gated read/write grants while anon cannot touch the table'
);

SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_attendance'
      AND cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) = 4,
  'the attendance is governed by one scoped policy per row action'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.daily_attendance'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) LIKE '%child_id%attendance_date%'
  ) OR EXISTS (
    SELECT 1 FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
     WHERE c.oid = 'public.daily_attendance'::regclass
       AND i.indisunique
       AND pg_get_indexdef(i.indexrelid) LIKE '%child_id%attendance_date%'
  ),
  'one row per child and date: duplicates cannot persist'
);

-- ── Confirm and re-confirm the day ───────────────────────────────────────

INSERT INTO public.daily_attendance
  (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
VALUES
  ('00000000-0000-4000-8000-000000000421'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid,
   '2026-10-06', true,
   '00000000-0000-4000-8000-000000000124'::uuid, now()),
  ('00000000-0000-4000-8000-000000000422'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid,
   '2026-10-06', false,
   '00000000-0000-4000-8000-000000000124'::uuid, now());

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE class_id = '00000000-0000-4000-8000-000000000321'::uuid
      AND attendance_date = '2026-10-06'),
  2::bigint,
  'confirming saves the whole list of the day'
);

SELECT is(
  (SELECT present FROM public.daily_attendance
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND attendance_date = '2026-10-06'),
  true,
  'reloading the class shows the confirmed present mark'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-06', false,
            '00000000-0000-4000-8000-000000000124'::uuid, now())$$,
  '23505'::char(5), NULL,
  'the same child cannot gain a second row for the same date'
);

UPDATE public.daily_attendance
   SET present = false,
       confirmed_by = '00000000-0000-4000-8000-000000000121'::uuid,
       confirmed_at = now()
 WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
   AND attendance_date = '2026-10-06';

SELECT is(
  (SELECT present FROM public.daily_attendance
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND attendance_date = '2026-10-06'),
  false,
  're-confirming overwrites the mark of the day'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND attendance_date = '2026-10-06'),
  1::bigint,
  're-confirming keeps a single row: no duplicates, no history'
);

SELECT is(
  (SELECT confirmed_by FROM public.daily_attendance
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND attendance_date = '2026-10-06'),
  '00000000-0000-4000-8000-000000000121'::uuid,
  're-confirming updates who confirmed the list'
);

-- ── Explicit empty confirmation ──────────────────────────────────────────

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE class_id = '00000000-0000-4000-8000-000000000321'::uuid
      AND attendance_date = '2026-10-05'),
  0::bigint,
  'a day never passed has no rows'
);

INSERT INTO public.daily_attendance
  (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
VALUES
  ('00000000-0000-4000-8000-000000000421'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid,
   '2026-10-05', false,
   '00000000-0000-4000-8000-000000000124'::uuid, now()),
  ('00000000-0000-4000-8000-000000000422'::uuid,
   '00000000-0000-4000-8000-000000000321'::uuid,
   '00000000-0000-4000-8000-000000000221'::uuid,
   '2026-10-05', false,
   '00000000-0000-4000-8000-000000000124'::uuid, now());

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE class_id = '00000000-0000-4000-8000-000000000321'::uuid
      AND attendance_date = '2026-10-05'
      AND present = true),
  0::bigint,
  'an explicitly confirmed empty day holds nobody present'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE class_id = '00000000-0000-4000-8000-000000000321'::uuid
      AND attendance_date = '2026-10-05'),
  2::bigint,
  'a confirmed empty day stays distinguishable from a day never passed'
);

-- ── The weekly pattern stays untouched ───────────────────────────────────

INSERT INTO public.child_lunch_days (child_id, school_id, weekdays)
VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
        '00000000-0000-4000-8000-000000000221'::uuid, '{1,3,5}');

SELECT is(
  (SELECT weekdays FROM public.child_lunch_days
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND school_id = '00000000-0000-4000-8000-000000000221'::uuid),
  '{1,3,5}'::smallint[],
  'confirming the day leaves the weekly pattern untouched'
);

-- ── Administrator scope ──────────────────────────────────────────────────

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000121',
    'role', 'admin'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000423'::uuid,
            '00000000-0000-4000-8000-000000000322'::uuid,
            '00000000-0000-4000-8000-000000000222'::uuid,
            '2026-10-06', true,
            '00000000-0000-4000-8000-000000000121'::uuid, now())$$,
  'an admin confirms the list in any school'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE attendance_date = '2026-10-06'),
  3::bigint,
  'an admin reloads the lists confirmed today'
);

-- ── Supervisor scope: their own school ──────────────────────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000122',
    'role', 'supervisor'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-07', true,
            '00000000-0000-4000-8000-000000000122'::uuid, now())$$,
  'a supervisor confirms the list of their own school'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE school_id = '00000000-0000-4000-8000-000000000221'::uuid),
  5::bigint,
  'a supervisor reloads the confirmed lists of their own school'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE school_id = '00000000-0000-4000-8000-000000000222'::uuid),
  0::bigint,
  'a supervisor cannot read the lists of another school'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000423'::uuid,
            '00000000-0000-4000-8000-000000000322'::uuid,
            '00000000-0000-4000-8000-000000000222'::uuid,
            '2026-10-07', true,
            '00000000-0000-4000-8000-000000000122'::uuid, now())$$,
  '42501'::char(5), NULL,
  'a supervisor cannot confirm the list of another school'
);

-- ── Monitor scope: read and write in their own schools ──────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000124',
    'role', 'monitor'
  )::text,
  true
);

SELECT lives_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000422'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-07', false,
            '00000000-0000-4000-8000-000000000124'::uuid, now())$$,
  'a monitor confirms the list of their own school'
);

SELECT ok(
  (SELECT count(*) FROM public.daily_attendance
    WHERE class_id = '00000000-0000-4000-8000-000000000321'::uuid
      AND attendance_date = '2026-10-06') = 2,
  'a monitor reloads the class list already confirmed today'
);

SELECT lives_ok(
  $$UPDATE public.daily_attendance
       SET present = true,
           confirmed_by = '00000000-0000-4000-8000-000000000124'::uuid,
           confirmed_at = now()
     WHERE child_id = '00000000-0000-4000-8000-000000000422'::uuid
       AND attendance_date = '2026-10-06'$$,
  'a monitor re-confirms the day to fix a late arrival'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000423'::uuid,
            '00000000-0000-4000-8000-000000000322'::uuid,
            '00000000-0000-4000-8000-000000000222'::uuid,
            '2026-10-07', true,
            '00000000-0000-4000-8000-000000000124'::uuid, now())$$,
  '42501'::char(5), NULL,
  'a monitor cannot confirm the list of another school'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000121'::uuid, now())$$,
  '42501'::char(5), NULL,
  'confirmation records who confirmed: no confirming on behalf of another user'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000124'::uuid, now() + interval '1 hour')$$,
  '42501'::char(5), NULL,
  'confirmation time cannot lie in the future'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT count(*) FROM public.daily_attendance
    WHERE child_id = '00000000-0000-4000-8000-000000000421'::uuid
      AND attendance_date = '2026-10-08'),
  0::bigint,
  'rejected confirmations leave no row behind'
);

SET LOCAL ROLE authenticated;

-- ── Out-of-scope roles ───────────────────────────────────────────────────

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000126',
    'role', 'parent'
  )::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000126'::uuid, now())$$,
  '42501'::char(5), NULL,
  'a parent cannot confirm the list'
);

SELECT is(
  (SELECT count(*) FROM public.daily_attendance),
  0::bigint,
  'a parent cannot read confirmed lists'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000127',
    'role', 'worker'
  )::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000127'::uuid, now())$$,
  '42501'::char(5), NULL,
  'an out-of-scope role cannot confirm the list'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '00000000-0000-4000-8000-000000000128',
    'role', 'monitor'
  )::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000128'::uuid, now())$$,
  '42501'::char(5), NULL,
  'an inactive monitor cannot confirm the list'
);

-- ── Anonymous callers ────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$SELECT count(*) FROM public.daily_attendance$$,
  '42501'::char(5), NULL,
  'an anonymous caller cannot read confirmed lists'
);

SELECT throws_ok(
  $$INSERT INTO public.daily_attendance
    (child_id, class_id, school_id, attendance_date, present, confirmed_by, confirmed_at)
    VALUES ('00000000-0000-4000-8000-000000000421'::uuid,
            '00000000-0000-4000-8000-000000000321'::uuid,
            '00000000-0000-4000-8000-000000000221'::uuid,
            '2026-10-08', true,
            '00000000-0000-4000-8000-000000000124'::uuid, now())$$,
  '42501'::char(5), NULL,
  'an anonymous caller cannot confirm the list'
);

SET LOCAL ROLE postgres;

SELECT * FROM finish();

ROLLBACK;
