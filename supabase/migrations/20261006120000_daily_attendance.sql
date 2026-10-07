-- Daily attendance confirmed by monitors.
--
-- Why: the classroom needs a confirmed list of who is present each day,
-- separate from the weekly lunch pattern (`child_lunch_days`) and from the
-- meal valuations (`meal_records`). Writing attendance never touches the
-- pattern nor the meal records, and nothing is inferred from them.
--
-- One row per (child, date):
--   * `present` marks present/absent for that day.
--   * `class_id` is stored on the row so the aula can reload its own list
--     for the day; the child keeps a single row per date even if the class
--     changes later.
--   * `confirmed_by` / `confirmed_at` record who confirmed and when.
--     Re-confirming overwrites the mark and the metadata in place: no
--     duplicates (unique constraint) and no history in this scope.
--   * A confirmed-empty day still writes one row per child (all absent), so
--     it stays distinguishable from a day never passed (no rows at all).
--     The explicit empty gesture itself lives in the worker UI; here the
--     contract is that all-absent rows persist and reload as such.
--
-- Write scope: the school's monitors plus the administrators of that
-- school (global admins and assigned supervisors). A supervisor's school
-- scope is the assignment itself: the live users table has no school
-- column, so school-level settings are reached only through
-- `school_supervisor_assignments`. Monitors reach their schools through
-- `private.current_user_monitor_school_ids()`. Parents, workers and
-- anonymous callers cannot read or write attendance.
--
-- Authorship: `confirmed_by` must be the confirming user themselves and
-- `confirmed_at` cannot lie in the future, mirroring the meal-records
-- authorship rule.

CREATE TABLE public.daily_attendance (
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  present boolean NOT NULL,
  confirmed_by uuid NOT NULL REFERENCES public.users(id),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (child_id, attendance_date)
);

CREATE INDEX daily_attendance_school_date_idx
  ON public.daily_attendance (school_id, attendance_date);

CREATE INDEX daily_attendance_class_date_idx
  ON public.daily_attendance (class_id, attendance_date);

ALTER TABLE public.daily_attendance ENABLE ROW LEVEL SECURITY;

-- Confirm scope: active admins (any school), supervisors assigned to the
-- row's school, and monitors assigned to the row's school.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_daily_attendance(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.current_user_active()
     AND (
       public.current_user_role() = 'admin'
       OR (
         public.current_user_role() = 'supervisor'
         AND EXISTS (
           SELECT 1
             FROM public.school_supervisor_assignments a
            WHERE a.school_id = p_school_id
              AND a.supervisor_id = public.current_user_id()
         )
       )
       OR (
         public.current_user_role() = 'monitor'
         AND p_school_id IN (SELECT private.current_user_monitor_school_ids())
       )
     );
$function$;
REVOKE ALL ON FUNCTION public.current_user_can_manage_daily_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_daily_attendance(uuid) TO authenticated;

-- Read scope matches the confirm scope: whoever may confirm may reload the
-- confirmed lists of their schools for the day and for later consultation.
CREATE OR REPLACE FUNCTION private.current_user_can_read_daily_attendance(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.current_user_can_manage_daily_attendance(p_school_id);
$function$;
REVOKE ALL ON FUNCTION private.current_user_can_read_daily_attendance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_read_daily_attendance(uuid) TO authenticated;

REVOKE ALL ON TABLE public.daily_attendance FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_attendance TO authenticated;

CREATE POLICY daily_attendance_select ON public.daily_attendance
  FOR SELECT TO authenticated
  USING (private.current_user_can_read_daily_attendance(school_id));

CREATE POLICY daily_attendance_insert ON public.daily_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_can_manage_daily_attendance(school_id)
    AND confirmed_by = public.current_user_id()
    AND confirmed_at <= now()
  );

CREATE POLICY daily_attendance_update ON public.daily_attendance
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_daily_attendance(school_id))
  WITH CHECK (
    public.current_user_can_manage_daily_attendance(school_id)
    AND confirmed_by = public.current_user_id()
    AND confirmed_at <= now()
  );

CREATE POLICY daily_attendance_delete ON public.daily_attendance
  FOR DELETE TO authenticated
  USING (public.current_user_can_manage_daily_attendance(school_id));
