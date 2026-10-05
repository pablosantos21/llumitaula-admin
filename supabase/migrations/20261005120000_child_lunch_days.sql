-- Weekly lunch pattern per child and school.
--
-- Why: the school needs each child's usual weekday lunch expectation next to
-- the child's own record, as the reference the daily list will be prepared
-- from. The pattern is a plain recurring week with no validity period, so it
-- stays separate from `meal_records`: writing a pattern never touches the
-- recorded meals, and nothing is inferred from them.
--
-- Three states must stay distinguishable:
--   * unconfigured            -> no row for (child, school)
--   * configured, no days     -> a row whose `weekdays` selection is empty
--   * configured with days    -> a row holding one or more weekdays
-- `weekdays` stores 1 = Monday .. 5 = Friday; weekends are not part of the
-- contract. The primary key keeps exactly one pattern per child and school,
-- so a class change inside the same school keeps the pattern, while a school
-- change leaves the origin school's pattern in place and lets the new school
-- start unconfigured (patterns are never copied between schools).

CREATE TABLE public.child_lunch_days (
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  weekdays smallint[] NOT NULL,
  PRIMARY KEY (child_id, school_id),
  CONSTRAINT child_lunch_days_weekdays_within_week
    CHECK (weekdays <@ ARRAY[1, 2, 3, 4, 5]::smallint[])
);

CREATE INDEX child_lunch_days_school_id_idx
  ON public.child_lunch_days (school_id);

ALTER TABLE public.child_lunch_days ENABLE ROW LEVEL SECURITY;

-- Write scope: administrators, plus the supervisors of the pattern's school.
-- A supervisor's school scope is the assignment itself: the live users table
-- has no school column, so school-level settings are reached only through
-- `school_supervisor_assignments`.
CREATE OR REPLACE FUNCTION public.current_user_can_manage_child_lunch_days(p_school_id uuid)
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
     );
$function$;
REVOKE ALL ON FUNCTION public.current_user_can_manage_child_lunch_days(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_manage_child_lunch_days(uuid) TO authenticated;

-- Read scope adds the monitors of the school: they consult the pattern as data
-- for the daily list but never write it.
CREATE OR REPLACE FUNCTION private.current_user_can_read_child_lunch_days(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.current_user_active()
     AND (
       public.current_user_can_manage_child_lunch_days(p_school_id)
       OR (
         public.current_user_role() = 'monitor'
         AND p_school_id IN (SELECT private.current_user_monitor_school_ids())
       )
     );
$function$;
REVOKE ALL ON FUNCTION private.current_user_can_read_child_lunch_days(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_can_read_child_lunch_days(uuid) TO authenticated;

REVOKE ALL ON TABLE public.child_lunch_days FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.child_lunch_days TO authenticated;

CREATE POLICY child_lunch_days_select ON public.child_lunch_days
  FOR SELECT TO authenticated
  USING (private.current_user_can_read_child_lunch_days(school_id));

CREATE POLICY child_lunch_days_insert ON public.child_lunch_days
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_manage_child_lunch_days(school_id));

CREATE POLICY child_lunch_days_update ON public.child_lunch_days
  FOR UPDATE TO authenticated
  USING (public.current_user_can_manage_child_lunch_days(school_id))
  WITH CHECK (public.current_user_can_manage_child_lunch_days(school_id));

CREATE POLICY child_lunch_days_delete ON public.child_lunch_days
  FOR DELETE TO authenticated
  USING (public.current_user_can_manage_child_lunch_days(school_id));
