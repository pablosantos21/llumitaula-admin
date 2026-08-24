-- Consolidate classroom-related SELECT policies while scoping supervisors to one school.

-- ============ classes ============
DROP POLICY IF EXISTS classes_select ON public.classes;
DROP POLICY IF EXISTS classes_supervisor_select ON public.classes;
DROP POLICY IF EXISTS "classes_view_parent_children_classes" ON public.classes;
DROP POLICY IF EXISTS "classes_view_monitor_schools" ON public.classes;
DROP POLICY IF EXISTS "classes_admin_view_all" ON public.classes;
DROP POLICY IF EXISTS "classes_public_select" ON public.classes;

CREATE POLICY classes_select ON public.classes
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (select auth.uid())
          AND u.role = 'admin'
      )
    )
    OR ((select auth.jwt()) ->> 'role') <> 'supervisor'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND school_id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

-- ============ schools ============
DROP POLICY IF EXISTS schools_select ON public.schools;
DROP POLICY IF EXISTS schools_supervisor_select ON public.schools;
DROP POLICY IF EXISTS "schools_view_monitor_assigned" ON public.schools;
DROP POLICY IF EXISTS "schools_view_parent_children_schools" ON public.schools;
DROP POLICY IF EXISTS "schools_admin_view_all" ON public.schools;
DROP POLICY IF EXISTS "schools_public_select" ON public.schools;

CREATE POLICY schools_select ON public.schools
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (select auth.uid())
          AND u.role = 'admin'
      )
    )
    OR ((select auth.jwt()) ->> 'role') <> 'supervisor'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND id = (
        SELECT u.school_id
        FROM public.users u
        WHERE u.id = (select auth.uid())
      )
    )
  );

-- ============ children ============
DROP POLICY IF EXISTS children_select ON public.children;
DROP POLICY IF EXISTS children_supervisor_select ON public.children;
DROP POLICY IF EXISTS "children_view_own_children" ON public.children;
DROP POLICY IF EXISTS "children_view_monitor_schools" ON public.children;
DROP POLICY IF EXISTS "children_admin_view_all" ON public.children;
DROP POLICY IF EXISTS "Admins access all children" ON public.children;
DROP POLICY IF EXISTS "Monitors access children" ON public.children;
DROP POLICY IF EXISTS "Parents access children" ON public.children;

CREATE POLICY children_select ON public.children
  FOR SELECT TO authenticated
  USING (
    ((select auth.jwt()) ->> 'role') = 'admin'
    OR (
      ((select auth.jwt()) ->> 'role') IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = (select auth.uid())
          AND u.role = 'admin'
      )
    )
    OR ((select auth.jwt()) ->> 'role') <> 'supervisor'
    OR (
      ((select auth.jwt()) ->> 'role') = 'supervisor'
      AND EXISTS (
        SELECT 1
        FROM public.classes c
        WHERE c.id = children.class_id
          AND c.school_id = (
            SELECT u.school_id
            FROM public.users u
            WHERE u.id = (select auth.uid())
          )
      )
    )
  );
